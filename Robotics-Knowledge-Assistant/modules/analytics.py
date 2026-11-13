"""Real SQLite-backed analytics computations."""

from typing import Any, Dict

from modules.vector_database import VectorDatabase


def compute_analytics(db: VectorDatabase) -> Dict[str, Any]:
    docs = db.list_documents()
    total_docs = len(docs)
    indexed_docs = sum(1 for d in docs if d["status"] == "indexed")
    total_chunks = sum(int(d["chunk_count"]) for d in docs)
    total_pages = sum(int(d["page_count"]) for d in docs)

    ft_rows = db.conn.execute(
        "SELECT file_type, COUNT(*) AS count, COALESCE(SUM(chunk_count), 0) AS chunks FROM documents GROUP BY file_type"
    ).fetchall()

    search_rows = db.conn.execute(
        "SELECT * FROM search_logs ORDER BY id DESC LIMIT 20"
    ).fetchall()

    gap_rows = db.conn.execute(
        """
        SELECT query, COUNT(*) AS occurrences, MAX(top_score) AS best_score, MAX(created_at) AS last_asked_at
        FROM search_logs
        WHERE has_gap = 1
        GROUP BY LOWER(TRIM(query))
        ORDER BY occurrences DESC
        """
    ).fetchall()

    return {
        "total_documents": total_docs,
        "indexed_documents": indexed_docs,
        "total_chunks": total_chunks,
        "total_pages": total_pages,
        "file_type_distribution": [dict(r) for r in ft_rows],
        "recent_uploads": docs[:5],
        "recent_searches": [dict(r) for r in search_rows],
        "knowledge_gaps": [dict(r) for r in gap_rows],
    }
