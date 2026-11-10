"""Real-world fixture: one page, recoverable text, and an embedded JPEG.

The skill delegates extraction, so this test carries a fixture-only extractor:
it proves the input guard accepts a real PDF, the page text survives, and the
image can be written as an asset beside the page-marked Markdown.
"""
import json
import re
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.check_input import main  # noqa: E402

PDF = Path(__file__).resolve().parent / "resources" / "embedded-images-tables.pdf"

EXPECTATIONS = json.loads(
    (Path(__file__).resolve().parent / "fixture-expectations.json").read_text(
        encoding="utf-8"
    )
)["fixtures"][PDF.stem]


def page_count(data: bytes) -> int:
    return len(re.findall(rb"/Type\s*/Page\b", data))


def read_objects(data: bytes) -> dict[int, tuple[bytes, bytes | None]]:
    """Map object number to (dictionary bytes, stream bytes or None)."""
    objects: dict[int, tuple[bytes, bytes | None]] = {}
    for match in re.finditer(rb"(\d+)\s+0\s+obj\b", data):
        number = int(match.group(1))
        after = match.end()
        stream_at = data.find(b"stream", after)
        endobj_at = data.find(b"endobj", after)

        if stream_at < 0 or (endobj_at >= 0 and endobj_at < stream_at):
            objects[number] = (
                data[after : endobj_at if endobj_at >= 0 else len(data)],
                None,
            )
            continue

        head = data[after:stream_at]
        start = stream_at + len(b"stream")
        if data[start : start + 2] == b"\r\n":
            start += 2
        elif data[start : start + 1] in (b"\n", b"\r"):
            start += 1

        if re.search(rb"/Length\s+\d+\s+0\s+R", head):
            end = data.find(b"endstream", start)
        else:
            length = re.search(rb"/Length\s+(\d+)", head)
            end = start + int(length.group(1)) if length else data.find(b"endstream", start)

        objects[number] = (head, data[start:end])
    return objects


def expand_object_streams(objects: dict[int, tuple[bytes, bytes | None]]) -> None:
    """Register the objects held inside compressed `/Type /ObjStm` containers."""
    for _, (head, stream) in list(objects.items()):
        if stream is None or not re.search(rb"/Type\s*/ObjStm\b", head):
            continue

        count_match = re.search(rb"/N\s+(\d+)", head)
        first_match = re.search(rb"/First\s+(\d+)", head)
        if not count_match or not first_match:
            continue

        raw = stream
        if b"/FlateDecode" in head:
            try:
                raw = zlib.decompress(raw)
            except zlib.error:
                continue

        first = int(first_match.group(1))
        pairs = [
            (int(number), int(offset))
            for number, offset in re.findall(rb"(\d+)\s+(\d+)", raw[:first])
        ]
        count = min(int(count_match.group(1)), len(pairs))

        for index in range(count):
            start = first + pairs[index][1]
            end = first + pairs[index + 1][1] if index + 1 < count else len(raw)
            if pairs[index][0] not in objects:
                objects[pairs[index][0]] = (raw[start:end], None)


def page_order(objects: dict[int, tuple[bytes, bytes | None]]) -> list[int]:
    """Page object numbers in `/Kids` order, falling back to file order."""
    for head, _ in objects.values():
        if re.search(rb"/Type\s*/Pages\b", head):
            kids = re.search(rb"/Kids\s*\[([^\]]*)\]", head)
            if kids:
                order = [int(number) for number in re.findall(rb"(\d+)\s+0\s+R", kids.group(1))]
                if order:
                    return order

    return [
        number
        for number, (head, _) in objects.items()
        if re.search(rb"/Type\s*/Page\b", head)
    ]


def text_from_stream(raw: bytes) -> str:
    if b"BT" not in raw or (b"Tj" not in raw and b"TJ" not in raw):
        return ""
    return " ".join(
        literal[1:-1].decode("latin-1", "replace")
        for literal in re.findall(rb"\((?:[^()\\]|\\.)*\)", raw)
    )


def list_pages(data: bytes) -> list[tuple[int, str]]:
    """Read every page in document order as (page number, text)."""
    objects = read_objects(data)
    expand_object_streams(objects)
    pages = []

    for index, number in enumerate(page_order(objects)):
        head, _ = objects.get(number, (b"", None))
        contents = re.search(rb"/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)", head)
        refs = (
            [int(ref) for ref in re.findall(rb"(\d+)\s+0\s+R", contents.group(1))]
            if contents
            else []
        )

        chunks = []
        for ref in refs:
            ref_head, stream = objects.get(ref, (b"", None))
            if stream is None:
                continue
            raw = stream
            if b"/FlateDecode" in ref_head:
                try:
                    raw = zlib.decompress(raw)
                except zlib.error:
                    continue
            piece = text_from_stream(raw)
            if piece:
                chunks.append(piece)

        pages.append((index + 1, " ".join(chunks)))

    return pages


def extract_text(data: bytes) -> str:
    return " ".join(text for _, text in list_pages(data) if text)


def extract_image(data: bytes):
    match = re.search(rb"/Subtype\s*/Image", data)
    if not match:
        return None
    index = match.start()
    head = data[data.rfind(b"<<", 0, index) : data.find(b"stream", index)]
    length = int(re.search(rb"/Length\s+(\d+)", head).group(1))
    start = data.find(b"stream", index) + len(b"stream")
    if data[start : start + 2] == b"\r\n":
        start += 2
    elif data[start : start + 1] in (b"\n", b"\r"):
        start += 1
    return {
        "bytes": data[start : start + length],
        "width": int(re.search(rb"/Width\s+(\d+)", head).group(1)),
        "height": int(re.search(rb"/Height\s+(\d+)", head).group(1)),
    }


def format_text(text: str, width: int = 100) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    lines = []
    line = ""
    for word in cleaned.split(" "):
        if not word:
            continue
        if len(line) + len(word) + 1 <= width:
            line = f"{line} {word}".strip()
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return "\n".join(lines)


def page_marked_markdown(pages: list[tuple[int, str]], name: str) -> str:
    """One marker per page, then the asset reference."""
    blocks = [
        f"<!-- page: {number} -->\n\n{format_text(text)}" for number, text in pages
    ]
    blocks.append(f"![Figure 1]({name}.assets/image-1.jpg)")
    return "\n\n".join(blocks) + "\n"


def write_extraction(data: bytes, out_dir: Path):
    """Write the fixture extraction, byte-identical to tests/embedded-pdf.mjs.

    Line endings are written explicitly as LF and the sidecar uses compact JSON,
    so this writer and the Node port produce exactly the same files on every
    platform. One marker is emitted per page read from the PDF.
    """
    name = PDF.stem
    pages = list_pages(data)
    image = extract_image(data)

    assets = out_dir / f"{name}.assets"
    assets.mkdir()
    image_path = assets / "image-1.jpg"
    image_path.write_bytes(image["bytes"])

    md = out_dir / f"{name}.md"
    md.write_bytes(page_marked_markdown(pages, name).encode("utf-8"))

    meta = out_dir / f"{name}.metadata.json"
    meta.write_bytes(
        json.dumps(
            {"docId": name, "pages": len(pages), "images": 1}, separators=(",", ":")
        ).encode("utf-8")
    )

    summary = out_dir / "summary.json"
    summary.write_bytes(
        json.dumps(
            {"documents": [{"name": name, "pages": len(pages), "images": 1}]},
            indent=2,
        ).encode("utf-8")
    )
    return md, meta, summary, image_path


class EmbeddedPdfFixtureTest(unittest.TestCase):
    def setUp(self):
        self.data = PDF.read_bytes()
        self.temp = tempfile.TemporaryDirectory()
        self.output = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_the_fixture_is_a_pdf(self):
        self.assertTrue(PDF.is_file())
        self.assertTrue(self.data.startswith(b"%PDF-1.7"))
        self.assertGreater(len(self.data), 100_000)

    def test_input_guard_accepts_the_pdf(self):
        self.assertEqual(main(["check_input.py", str(PDF)]), 0)

    def test_page_count_matches_expectations(self):
        self.assertEqual(page_count(self.data), EXPECTATIONS["pages"])

    def test_article_text_is_recoverable(self):
        text = extract_text(self.data).lower()
        self.assertIn("inhibitor", text)
        self.assertIn("stainless", text)

    def test_embedded_image_is_a_jpeg(self):
        image = extract_image(self.data)
        self.assertIsNotNone(image)
        self.assertEqual(image["width"], 1001)
        self.assertEqual(image["height"], 673)
        self.assertTrue(image["bytes"].startswith(b"\xff\xd8\xff"))

    def test_markdown_and_asset_are_written(self):
        md, meta, summary, image_path = write_extraction(self.data, self.output)

        body = md.read_text(encoding="utf-8")
        self.assertTrue(body.startswith("<!-- page: 1 -->"))
        self.assertIn("inhibitor", body.lower())
        self.assertIn(f"({PDF.stem}.assets/image-1.jpg)", body)

        self.assertTrue(image_path.is_file())
        self.assertTrue(image_path.read_bytes().startswith(b"\xff\xd8\xff"))

        metadata = json.loads(meta.read_text(encoding="utf-8"))
        manifest = json.loads(summary.read_text(encoding="utf-8"))
        self.assertEqual(metadata["images"], 1)
        self.assertEqual(manifest["documents"][0]["images"], 1)


if __name__ == "__main__":
    unittest.main()
