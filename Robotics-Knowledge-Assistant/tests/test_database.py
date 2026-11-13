"""Tests for persistent SQLite/ChromaDB repository operations."""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config
from modules.text_chunker import TextChunk
from modules.vector_database import VectorDatabase


class TestDatabase(unittest.TestCase):
    def test_upsert_and_delete_document_preserves_consistency(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            orig_db = config.SQLITE_DB_PATH
            orig_chroma = config.CHROMA_DIR
            config.SQLITE_DB_PATH = Path(tmpdir) / "test.db"
            config.CHROMA_DIR = Path(tmpdir) / "chroma"
            try:
                import modules.vector_database as vdb_mod

                vdb_mod.SQLITE_DB_PATH = config.SQLITE_DB_PATH
                vdb_mod.CHROMA_DIR = config.CHROMA_DIR
                db = VectorDatabase()

                chunk = TextChunk(
                    chunk_id="doc_a_v1_p1_c0",
                    doc_id="doc_a",
                    filename="ros2.txt",
                    domain="ROS and ROS2",
                    file_type="txt",
                    doc_version=1,
                    chunk_index=0,
                    page_number=1,
                    content="ROS2 Nav2 uses behavior trees.",
                    word_count=5,
                )
                db.upsert_document(
                    {
                        "id": "doc_a",
                        "filename": "ros2.txt",
                        "file_type": "txt",
                        "file_size": 30,
                        "file_hash": "hash_a",
                        "domain": "ROS and ROS2",
                        "version": 1,
                        "page_count": 1,
                        "status": "indexed",
                    },
                    chunks=[chunk],
                    embeddings=[[0.1] * 384],
                )
                self.assertEqual(len(db.list_documents()), 1)
                self.assertEqual(len(db.list_all_chunks()), 1)
                self.assertTrue(db.delete_document("doc_a"))
                self.assertEqual(len(db.list_documents()), 0)
                self.assertEqual(len(db.list_all_chunks()), 0)
                db.conn.close()
            finally:
                config.SQLITE_DB_PATH = orig_db
                config.CHROMA_DIR = orig_chroma


if __name__ == "__main__":
    unittest.main()
