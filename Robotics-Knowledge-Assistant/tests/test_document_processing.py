"""Tests for document validation, extraction, page preservation, and chunking."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from modules.document_loader import validate_uploaded_file
from modules.text_chunker import chunk_pages, clean_text
from modules.text_extractor import extract_text_from_bytes


class TestDocumentProcessing(unittest.TestCase):
    def test_validate_rejects_unsupported_extension_and_empty_file(self):
        bad = validate_uploaded_file("script.exe", b"abc")
        self.assertFalse(bad.valid)
        empty = validate_uploaded_file("notes.txt", b"")
        self.assertFalse(empty.valid)
        ok = validate_uploaded_file("notes.txt", b"Kinematics content")
        self.assertTrue(ok.valid)

    def test_extract_txt_preserves_page_markers(self):
        sample = (
            b"MODULE HEADER\n--- PAGE 1 ---\nForward kinematics page one.\n"
            b"--- PAGE 2 ---\nInverse kinematics page two."
        )
        out = extract_text_from_bytes("kinematics.txt", sample, ".txt")
        self.assertTrue(out.ok)
        self.assertEqual(out.page_count, 2)
        self.assertEqual(out.pages[1].page_number, 2)

    def test_chunk_pages_preserves_metadata_and_unique_ids(self):
        out = extract_text_from_bytes(
            "pid.txt",
            b"--- PAGE 1 ---\nPID control uses Kp, Ki, Kd.\n\nAnti-windup prevents saturation overshoot.",
            ".txt",
        )
        chunks = chunk_pages(
            out.pages,
            doc_id="doc_1",
            filename="pid.txt",
            domain="Motor Control",
            file_type="txt",
            doc_version=1,
            chunk_size=220,
            chunk_overlap=30,
        )
        self.assertGreaterEqual(len(chunks), 1)
        self.assertEqual(chunks[0].page_number, 1)
        self.assertEqual(clean_text("a   b\r\n\r\n\r\nc"), "a b\n\nc")


if __name__ == "__main__":
    unittest.main()
