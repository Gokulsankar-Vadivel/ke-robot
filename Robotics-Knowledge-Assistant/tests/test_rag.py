"""Tests for RAG unsupported-query guardrails, source preparation, and Ollama error handling."""

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from modules.embedding_manager import EmbeddingManager
from modules.rag_engine import answer_question
from modules.source_manager import prepare_sources
from modules.text_chunker import TextChunk
import modules.vector_database as vdb_mod


class TestRag(unittest.TestCase):
    def test_prepare_sources_deduplicates_identical_excerpts(self):
        items = [
            {"doc_id": "d1", "filename": "a.txt", "domain": "ROS", "page_number": 1, "combined_score": 0.8, "content": "ROS2 uses DDS."},
            {"doc_id": "d1", "filename": "a.txt", "domain": "ROS", "page_number": 1, "combined_score": 0.7, "content": "ROS2 uses DDS."},
        ]
        sources = prepare_sources(items)
        self.assertEqual(len(sources), 1)

    def test_unsupported_question_returns_insufficient_evidence(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            vdb_mod.SQLITE_DB_PATH = Path(tmpdir) / "test.db"
            vdb_mod.CHROMA_DIR = Path(tmpdir) / "chroma"
            db = vdb_mod.VectorDatabase()
            embedder = EmbeddingManager(use_transformer=False)
            res = answer_question("What is the recipe for chocolate cake?", db=db, embedder=embedder)
            self.assertTrue(res["insufficient_evidence"])
            self.assertEqual(res["sources"], [])
            db.conn.close()

    def test_ollama_failure_raises_clean_user_message(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            vdb_mod.SQLITE_DB_PATH = Path(tmpdir) / "test.db"
            vdb_mod.CHROMA_DIR = Path(tmpdir) / "chroma"
            db = vdb_mod.VectorDatabase()
            embedder = EmbeddingManager(use_transformer=False)
            c1 = TextChunk("d1_p1_c0", "d1", "pid.txt", "Motor Control", "txt", 1, 0, 1,
                           "PID derivative gain adds damping to reduce overshoot.", 9)
            db.upsert_document(
                {
                    "id": "d1",
                    "filename": "pid.txt",
                    "file_type": "txt",
                    "file_size": 80,
                    "file_hash": "h1",
                    "domain": "Motor Control",
                    "version": 1,
                    "page_count": 1,
                    "status": "indexed",
                },
                chunks=[c1],
                embeddings=embedder.embed_documents([c1.content]),
            )
            with patch("modules.rag_engine.generate_ollama_answer", side_effect=RuntimeError("The AI model is not available. Please start Ollama.")):
                with self.assertRaises(RuntimeError) as ctx:
                    answer_question("PID derivative gain overshoot", db=db, embedder=embedder)
                self.assertIn("Please start Ollama", str(ctx.exception))
            db.conn.close()


if __name__ == "__main__":
    unittest.main()
