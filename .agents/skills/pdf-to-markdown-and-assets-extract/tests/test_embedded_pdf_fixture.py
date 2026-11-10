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

PDF = Path(__file__).resolve().parent / "embedded-images-tables.pdf"


def page_count(data: bytes) -> int:
    return len(re.findall(rb"/Type\s*/Page\b", data))


def extract_text(data: bytes) -> str:
    chunks = []
    for match in re.finditer(rb"stream\r?\n", data):
        start = match.end()
        end = data.find(b"endstream", start)
        if end < 0:
            continue
        raw = data[start:end]
        prefix = data[max(0, match.start() - 400) : match.start()]
        if b"/FlateDecode" not in prefix:
            continue
        try:
            raw = zlib.decompress(raw)
        except zlib.error:
            continue
        if b"BT" not in raw or (b"Tj" not in raw and b"TJ" not in raw):
            continue
        for literal in re.findall(rb"\((?:[^()\\]|\\.)*\)", raw):
            chunks.append(literal[1:-1].decode("latin-1", "replace"))
    return " ".join(chunks)


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


def write_extraction(data: bytes, out_dir: Path):
    name = PDF.stem
    text = extract_text(data)
    image = extract_image(data)

    assets = out_dir / f"{name}.assets"
    assets.mkdir()
    image_path = assets / "image-1.jpg"
    image_path.write_bytes(image["bytes"])

    md = out_dir / f"{name}.md"
    md.write_text(
        f"<!-- page: 1 -->\n\n{format_text(text)}\n\n![Figure 1]({name}.assets/image-1.jpg)\n",
        encoding="utf-8",
    )

    meta = out_dir / f"{name}.metadata.json"
    meta.write_text(
        json.dumps({"docId": name, "pages": 1, "images": 1}),
        encoding="utf-8",
    )

    summary = out_dir / "summary.json"
    summary.write_text(
        json.dumps({"documents": [{"name": name, "pages": 1, "images": 1}]}, indent=2),
        encoding="utf-8",
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

    def test_one_page(self):
        self.assertEqual(page_count(self.data), 1)

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
