"""Semantic vector search over ChromaDB with metadata filtering."""

import math
from typing import Any, Dict, List, Optional

from modules.embedding_manager import EmbeddingManager
from modules.vector_database import VectorDatabase


def _cosine(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (na * nb)))


def semantic_search(
    query: str,
    db: VectorDatabase,
    embedder: EmbeddingManager,
    top_k: int = 5,
    domain_filter: Optional[str] = None,
    file_type_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    query_vec = embedder.embed_query(query)

    where: Optional[Dict[str, Any]] = None
    conditions = []
    if domain_filter and domain_filter != "all":
        conditions.append({"domain": domain_filter})
    if file_type_filter and file_type_filter != "all":
        conditions.append({"file_type": file_type_filter})
    if len(conditions) == 1:
        where = conditions[0]
    elif len(conditions) > 1:
        where = {"$and": conditions}

    if db.chroma_active:
        return db.query_chroma(query_vec, top_k=top_k, where_filter=where)

    # Pure-Python fallback when ChromaDB is not installed in environment
    all_chunks = db.list_all_chunks()
    filtered = [
        c
        for c in all_chunks
        if (not domain_filter or domain_filter == "all" or c["domain"] == domain_filter)
        and (not file_type_filter or file_type_filter == "all" or c["file_type"] == file_type_filter)
    ]
    if not filtered:
        return []

    chunk_vecs = embedder.embed_documents([c["content"] for c in filtered])
    scored = []
    for chunk, vec in zip(filtered, chunk_vecs):
        sim = _cosine(query_vec, vec)
        scored.append(
            {
                "chunk_id": chunk["id"],
                "content": chunk["content"],
                "doc_id": chunk["doc_id"],
                "filename": chunk["filename"],
                "domain": chunk["domain"],
                "file_type": chunk["file_type"],
                "page_number": int(chunk["page_number"]),
                "doc_version": int(chunk["doc_version"]),
                "semantic_score": round(sim, 4),
            }
        )
    scored.sort(key=lambda x: x["semantic_score"], reverse=True)
    return scored[:top_k]
