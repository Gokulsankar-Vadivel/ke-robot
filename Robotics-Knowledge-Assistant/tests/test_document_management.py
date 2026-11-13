"""Tests for document upload, duplicate detection, versioned update, and deletion."""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from modules.document_manager import DocumentManager
from modules.embedding_manager import EmbeddingManager
import modules.document_loader as loader_mod
import modules.vector_database as vdb_mod


class TestDocumentManagement(unittest.TestCase):
    def test_ingest_duplicate_update_and_delete(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            vdb_mod.SQLITE_DB_PATH = Path(tmpdir) / "test.db"
            vdb_mod.CHROMA_DIR = Path(tmpdir) / "chroma"
            loader_mod.UPLOAD_DIR = Path(tmpdir) / "uploads"

            db = vdb_mod.VectorDatabase()
            embedder = EmbeddingManager(use_transformer=False)
            mgr = DocumentManager(db=db, embedder=embedder)

            res1 = mgr.ingest_bytes("esp32.txt", b"ESP32 has dual core CPU and hardware PWM.", domain="Arduino & ESP32")
            self.assertEqual(res1["status"], "indexed")
            doc_id = res1["document"]["id"]

            dup = mgr.ingest_bytes("esp32_copy.txt", b"ESP32 has dual core CPU and hardware PWM.")
            self.assertEqual(dup["status"], "duplicate")

            upd = mgr.update_document(doc_id, b"ESP32 version 2 adds MCPWM and FreeRTOS tasks.")
            self.assertEqual(upd["status"], "indexed")
            self.assertEqual(upd["document"]["version"], 2)

            self.assertTrue(mgr.delete_document(doc_id))
            self.assertEqual(len(db.list_documents()), 0)
            db.conn.close()


if __name__ == "__main__":
    unittest.main()
