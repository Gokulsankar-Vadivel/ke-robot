"""Local embedding manager using Sentence Transformers (all-MiniLM-L6-v2) with caching."""

import hashlib
import math
import re
from functools import lru_cache
from typing import List, Sequence

from config import EMBEDDING_MODEL_NAME


@lru_cache(maxsize=1)
def _load_sentence_transformer():
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore

        return SentenceTransformer(EMBEDDING_MODEL_NAME)
    except Exception:
        return None


def _fallback_dense_embedding(text: str, dim: int = 384) -> List[float]:
    """Deterministic L2-normalized local projection when model weights are unavailable offline."""
    vec = [0.0] * dim
    tokens = re.findall(r"[a-z0-9_+-]{2,}", text.lower())
    if not tokens:
        return vec
    for tok in tokens:
        digest = hashlib.blake2b(tok.encode("utf-8"), digest_size=8).digest()
        val = int.from_bytes(digest, "little")
        idx = val % dim
        sign = 1.0 if (val & 1) == 0 else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 6) for v in vec]


class EmbeddingManager:
    """Lazy-loaded, cached local embedding generator with batch support."""

    def __init__(self, use_transformer: bool = True) -> None:
        self.use_transformer = use_transformer

    def embed_documents(self, texts: Sequence[str], batch_size: int = 32) -> List[List[float]]:
        if not texts:
            return []
        model = _load_sentence_transformer() if self.use_transformer else None
        if model is not None:
            vectors = model.encode(
                list(texts),
                batch_size=batch_size,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            return [v.tolist() for v in vectors]
        return [_fallback_dense_embedding(t) for t in texts]

    def embed_query(self, query: str) -> List[float]:
        return self.embed_documents([query])[0]
