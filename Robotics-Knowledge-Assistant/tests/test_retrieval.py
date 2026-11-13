"""Tests for semantic and hybrid retrieval ranking."""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from modules.embedding_manager import EmbeddingManager
from modules.hybrid_search import hybrid_search
from modules.text_chunker import TextChunk
import modules.vector_database as vdb_mod


class TestRetrieval(unittest.TestCase):
    def test_hybrid_search_ranks_relevant_chunk_first(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            vdb_mod.SQLITE_DB_PATH = Path(tmpdir) / "test.db"
            vdb_mod.CHROMA_DIR = Path(tmpdir) / "chroma"
            db = vdb_mod.VectorDatabase()
            embedder = EmbeddingManager(use_transformer=False)

            c1 = TextChunk("d1_p1_c0", "d1", "slam.txt", "SLAM & Path Planning", "txt", 1, 0, 1,
                           "Graph SLAM detects loop closures and optimizes robot pose graphs.", 10)
            c2 = TextChunk("d2_p1_c0", "d2", "pid.txt", "Motor Control", "txt", 1, 0, 1,
                           "PID derivative gain adds damping to reduce step overshoot.", 10)
            for c, fhash in ((c1, "h1"), (c2, "h2")):
                db.upsert_document(
                    {
                        "id": c.doc_id,
                        "filename": c.filename,
                        "file_type": "txt",
                        "file_size": 100,
                        "file_hash": fhash,
                        "domain": c.domain,
                        "version": 1,
                        "page_count": 1,
                        "status": "indexed",
                    },
                    chunks=[c],
                    embeddings=embedder.embed_documents([c.content]),
                )

            results = hybrid_search("How does loop closure work in Graph SLAM?", db=db, embedder=embedder, top_k=2)
            self.assertEqual(results[0]["doc_id"], "d1")
            db.conn.close()


if __name__ == "__main__":
    unittest.main()
