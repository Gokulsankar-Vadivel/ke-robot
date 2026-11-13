"""Source citation verification and explainability formatting."""

from typing import Any, Dict, List


def prepare_sources(retrieved_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sources: List[Dict[str, Any]] = []
    seen = set()

    for chunk in retrieved_chunks:
        dedupe_key = (chunk["doc_id"], chunk["page_number"], chunk["content"][:60])
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        citation_idx = len(sources) + 1
        sources.append(
            {
                "citation_index": citation_idx,
                "doc_id": chunk["doc_id"],
                "filename": chunk["filename"],
                "domain": chunk["domain"],
                "page_number": chunk["page_number"],
                "score": chunk.get("combined_score", chunk.get("semantic_score", 0.0)),
                "excerpt": chunk["content"],
            }
        )
    return sources
