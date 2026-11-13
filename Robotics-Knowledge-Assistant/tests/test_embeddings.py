"""Tests for local embedding generation and vector normalization."""

import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from modules.embedding_manager import EmbeddingManager


class TestEmbeddings(unittest.TestCase):
    def test_fallback_embeddings_are_normalized_and_consistent(self):
        embedder = EmbeddingManager(use_transformer=False)
        vecs = embedder.embed_documents(["ROS2 uses DDS discovery", "ROS2 uses DDS discovery"])
        self.assertEqual(len(vecs), 2)
        self.assertEqual(len(vecs[0]), 384)
        norm = math.sqrt(sum(v * v for v in vecs[0]))
        self.assertAlmostEqual(norm, 1.0, places=3)
        self.assertEqual(vecs[0], vecs[1])


if __name__ == "__main__":
    unittest.main()
