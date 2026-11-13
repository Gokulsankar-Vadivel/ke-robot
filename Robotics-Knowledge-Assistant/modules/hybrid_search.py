"""Hybrid search combining dense semantic retrieval and BM25 lexical scoring."""

import math
import re
from collections import Counter
from typing import Any, Dict, List, Optional

from modules.embedding_manager import EmbeddingManager
from modules.semantic_search import semantic_search
from modules.vector_database import VectorDatabase


def _tokenize(text: str) -> List[str]:
    return [t for t in re.findall(r"[a-z0-9_+-]{2,}", text.lower())]


def keyword_bm25_search(
    query: str,
    chunks: List[Dict[str, Any]],
    top_k: int = 10,
) -> Dict[str, float]:
    query_tokens = _tokenize(query)
    if not query_tokens or not chunks:
        return {}

    tokenized = [_tokenize(c["content"]) for c in chunks]
    avg_len = sum(len(t) for t in tokenized) / len(tokenized)
    total_docs = len(chunks)

    df: Counter = Counter()
    for doc_toks in tokenized:
        df.update(set(doc_toks))

    k1, b = 1.5, 0.75
    raw_scores: Dict[str, float] = {}
    unique_q = set(query_tokens)

    for chunk, doc_toks in zip(chunks, tokenized):
        tf = Counter(doc_toks)
        score = 0.0
        for qt in unique_q:
            freq = tf.get(qt, 0)
            if freq == 0:
                continue
            idf = math.log(1 + (total_docs - df[qt] + 0.5) / (df[qt] + 0.5))
            denom = freq + k1 * (1 - b + b * (len(doc_toks) / max(1.0, avg_len)))
            score += idf * ((freq * (k1 + 1)) / denom)
        cid = chunk.get("id") or chunk.get("chunk_id")
        raw_scores[cid] = score

    max_score = max(raw_scores.values(), default=0.0)
    if max_score <= 0:
        return {k: 0.0 for k in raw_scores}
    return {k: round(v / max_score, 4) for k, v in raw_scores.items()}


def hybrid_search(
    query: str,
    db: VectorDatabase,
    embedder: EmbeddingManager,
    top_k: int = 5,
    mode: str = "hybrid",
    domain_filter: Optional[str] = None,
    file_type_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    sem_results = semantic_search(
        query,
        db,
        embedder,
        top_k=max(top_k * 2, 10),
        domain_filter=domain_filter,
        file_type_filter=file_type_filter,
    )

    all_chunks = [
        c
        for c in db.list_all_chunks()
        if (not domain_filter or domain_filter == "all" or c["domain"] == domain_filter)
        and (not file_type_filter or file_type_filter == "all" or c["file_type"] == file_type_filter)
    ]
    bm25_scores = keyword_bm25_search(query, all_chunks, top_k=len(all_chunks))

    sem_by_id = {r["chunk_id"]: r for r in sem_results}
    merged: List[Dict[str, Any]] = []

    for chunk in all_chunks:
        cid = chunk["id"]
        sem_score = sem_by_id.get(cid, {}).get("semantic_score", 0.0)
        kw_score = bm25_scores.get(cid, 0.0)

        if mode == "semantic":
            combined = sem_score
        elif mode == "keyword":
            combined = kw_score
        else:
            combined = 0.58 * sem_score + 0.42 * kw_score

        merged.append(
            {
                "chunk_id": cid,
                "doc_id": chunk["doc_id"],
                "filename": chunk["filename"],
                "domain": chunk["domain"],
                "file_type": chunk["file_type"],
                "page_number": int(chunk["page_number"]),
                "doc_version": int(chunk["doc_version"]),
                "content": chunk["content"],
                "semantic_score": round(sem_score, 4),
                "keyword_score": round(kw_score, 4),
                "combined_score": round(combined, 4),
            }
        )

    merged.sort(key=lambda x: x["combined_score"], reverse=True)
    return merged[:top_k]
