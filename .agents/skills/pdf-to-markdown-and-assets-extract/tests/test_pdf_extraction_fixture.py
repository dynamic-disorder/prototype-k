"""A generated one-page PDF, extracted to page-marked Markdown.

The skill delegates extraction to the project's extractor, so this test carries a
fixture-only extractor: it proves the input guard accepts a real PDF and that the
documented output contract (page-marked .md, metadata sidecar, summary) can be
written and read.
"""
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.check_input import main  # noqa: E402

TEXT_OPERATOR = re.compile(rb"\((.*?)\)\s*Tj", re.DOTALL)


def make_pdf(text: str) -> bytes:
    """Build a minimal valid one-page PDF with one text run."""
    content = f"BT /F1 24 Tf 72 720 Td ({text}) Tj ET".encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(content)).encode("ascii") + b" >>\nstream\n" + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(out))
        out += f"{index} 0 obj\n".encode("ascii") + obj + b"\nendobj\n"

    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode("ascii")
    out += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        out += f"{offset:010d} 00000 n \n".encode("ascii")
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    ).encode("ascii")
    return bytes(out)


def extract_fixture_text(pdf_bytes: bytes) -> str:
    """Read the single Tj operator from the fixture's content stream."""
    match = TEXT_OPERATOR.search(pdf_bytes)
    return match.group(1).decode("latin-1") if match else ""


def write_extraction(pdf: Path, out_dir: Path):
    """Write the page-marked Markdown and sidecars the skill documents."""
    name = pdf.stem
    text = extract_fixture_text(pdf.read_bytes())
    md = out_dir / f"{name}.md"
    md.write_text(f"<!-- page: 1 -->\n\n{text}\n", encoding="utf-8")

    meta = out_dir / f"{name}.metadata.json"
    meta.write_text(
        json.dumps({"docId": name, "edition": "test", "pages": 1, "textPages": 1}),
        encoding="utf-8",
    )

    summary = out_dir / "summary.json"
    summary.write_text(
        json.dumps({"documents": [{"name": name, "pages": 1}]}, indent=2),
        encoding="utf-8",
    )
    return md, meta, summary


class PdfExtractionFixtureTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.input_dir = self.root / "input"
        self.output_dir = self.root / "extracted"
        self.input_dir.mkdir()
        self.output_dir.mkdir()
        self.pdf = self.input_dir / "sample.pdf"
        self.pdf.write_bytes(make_pdf("Hello PDF extraction"))

    def tearDown(self):
        self.temp.cleanup()

    def test_the_fixture_is_a_pdf(self):
        self.assertTrue(self.pdf.read_bytes().startswith(b"%PDF-1.4"))

    def test_input_guard_accepts_the_pdf(self):
        self.assertEqual(main(["check_input.py", str(self.pdf)]), 0)

    def test_fixture_text_is_recoverable(self):
        self.assertEqual(extract_fixture_text(self.pdf.read_bytes()), "Hello PDF extraction")

    def test_markdown_has_a_page_marker_and_the_text(self):
        md, _, _ = write_extraction(self.pdf, self.output_dir)
        body = md.read_text(encoding="utf-8")
        self.assertTrue(body.startswith("<!-- page: 1 -->"))
        self.assertIn("Hello PDF extraction", body)

    def test_sidecar_and_summary_are_valid_json(self):
        _, meta, summary = write_extraction(self.pdf, self.output_dir)
        metadata = json.loads(meta.read_text(encoding="utf-8"))
        manifest = json.loads(summary.read_text(encoding="utf-8"))
        self.assertEqual(metadata["pages"], 1)
        self.assertEqual(manifest["documents"][0]["name"], "sample")

    def test_the_guard_script_runs_from_the_command_line(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "check_input.py"), str(self.pdf)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("input ok: 1 PDF(s)", result.stdout)


if __name__ == "__main__":
    unittest.main()
