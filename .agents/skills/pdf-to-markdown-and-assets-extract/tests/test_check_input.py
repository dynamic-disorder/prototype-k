import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.check_input import find_pdfs, main  # noqa: E402


class FindPdfsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "a.pdf").write_text("a", encoding="utf-8")
        (self.root / "b.PDF").write_text("b", encoding="utf-8")
        (self.root / "note.txt").write_text("not a pdf", encoding="utf-8")
        (self.root / "nested").mkdir()
        (self.root / "nested" / "c.pdf").write_text("c", encoding="utf-8")
        (self.root / "empty").mkdir()

    def tearDown(self):
        self.temp.cleanup()

    def test_single_pdf_file(self):
        self.assertEqual(find_pdfs(self.root / "a.pdf"), [self.root / "a.pdf"])

    def test_uppercase_suffix(self):
        self.assertEqual(find_pdfs(self.root / "b.PDF"), [self.root / "b.PDF"])

    def test_folder_returns_every_pdf_sorted(self):
        found = find_pdfs(self.root)
        self.assertEqual(
            [path.relative_to(self.root).as_posix() for path in found],
            ["a.pdf", "b.PDF", "nested/c.pdf"],
        )

    def test_non_pdf_file(self):
        self.assertEqual(find_pdfs(self.root / "note.txt"), [])

    def test_missing_path(self):
        self.assertEqual(find_pdfs(self.root / "missing.pdf"), [])

    def test_empty_folder(self):
        self.assertEqual(find_pdfs(self.root / "empty"), [])


class MainTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.pdf = self.root / "doc.pdf"
        self.pdf.write_text("pdf", encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def run_main(self, argv):
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = main(argv)
        return code, stdout.getvalue(), stderr.getvalue()

    def test_accepts_a_pdf(self):
        code, out, err = self.run_main(["check_input.py", str(self.pdf)])
        self.assertEqual(code, 0)
        self.assertIn("input ok: 1 PDF(s)", out)
        self.assertEqual(err, "")

    def test_rejects_a_text_file(self):
        note = self.root / "note.txt"
        note.write_text("x", encoding="utf-8")
        code, out, err = self.run_main(["check_input.py", str(note)])
        self.assertEqual(code, 1)
        self.assertIn("names no PDF; extraction not started.", err)
        self.assertEqual(out, "")

    def test_rejects_a_missing_path(self):
        code, _, err = self.run_main(["check_input.py", str(self.root / "nope.pdf")])
        self.assertEqual(code, 1)
        self.assertIn("names no PDF", err)

    def test_usage_without_path(self):
        code, _, err = self.run_main(["check_input.py"])
        self.assertEqual(code, 1)
        self.assertIn("usage: check_input.py", err)


if __name__ == "__main__":
    unittest.main()
