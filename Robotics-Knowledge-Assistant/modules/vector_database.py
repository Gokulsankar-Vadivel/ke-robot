"""Persistent vector storage (ChromaDB) and relational metadata store (SQLite)."""

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from config import CHROMA_COLLECTION_NAME, CHROMA_DIR, SQLITE_DB_PATH
from modules.text_chunker import TextChunk


def get_sqlite_connection() -> sqlite3.Connection:
    SQLITE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(SQLITE_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            file_hash TEXT NOT NULL,
            domain TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            page_count INTEGER NOT NULL DEFAULT 0,
            chunk_count INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL,
            error_message TEXT,
            needs_ocr INTEGER NOT NULL DEFAULT 0,
            storage_path TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY,
            doc_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            page_number INTEGER NOT NULL,
            content TEXT NOT NULL,
            word_count INTEGER NOT NULL,
            doc_version INTEGER NOT NULL,
            FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS search_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query TEXT NOT NULL,
            mode TEXT NOT NULL,
            top_score REAL NOT NULL,
            result_count INTEGER NOT NULL,
            has_gap INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        """
    )
    conn.commit()
    return conn


class VectorDatabase:
    """Manages persistent ChromaDB vectors alongside SQLite document metadata."""

    def __init__(self) -> None:
        self.conn = get_sqlite_connection()
        self._collection = self._init_chroma_collection()

    def _init_chroma_collection(self):
        try:
            import chromadb  # type: ignore

            client = chromadb.PersistentClient(path=str(CHROMA_DIR))
            return client.get_or_create_collection(
                name=CHROMA_COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
        except Exception:
            return None

    @property
    def chroma_active(self) -> bool:
        return self._collection is not None

    def find_duplicate_by_hash(self, file_hash: str, exclude_doc_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if exclude_doc_id:
            row = self.conn.execute(
                "SELECT * FROM documents WHERE file_hash = ? AND id != ? LIMIT 1",
                (file_hash, exclude_doc_id),
            ).fetchone()
        else:
            row = self.conn.execute(
                "SELECT * FROM documents WHERE file_hash = ? LIMIT 1", (file_hash,)
            ).fetchone()
        return dict(row) if row else None

    def upsert_document(
        self,
        doc_meta: Dict[str, Any],
        chunks: List[TextChunk],
        embeddings: List[List[float]],
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        existing = self.get_document(doc_meta["id"])
        created_at = existing["created_at"] if existing else now

        with self.conn:
            self.conn.execute(
                """
                INSERT INTO documents (
                    id, filename, file_type, file_size, file_hash, domain, version,
                    page_count, chunk_count, status, error_message, needs_ocr, storage_path,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    filename = excluded.filename,
                    file_type = excluded.file_type,
                    file_size = excluded.file_size,
                    file_hash = excluded.file_hash,
                    domain = excluded.domain,
                    version = excluded.version,
                    page_count = excluded.page_count,
                    chunk_count = excluded.chunk_count,
                    status = excluded.status,
                    error_message = excluded.error_message,
                    needs_ocr = excluded.needs_ocr,
                    storage_path = excluded.storage_path,
                    updated_at = excluded.updated_at
                """,
                (
                    doc_meta["id"],
                    doc_meta["filename"],
                    doc_meta["file_type"],
                    doc_meta["file_size"],
                    doc_meta["file_hash"],
                    doc_meta["domain"],
                    doc_meta["version"],
                    doc_meta["page_count"],
                    len(chunks),
                    doc_meta["status"],
                    doc_meta.get("error_message"),
                    1 if doc_meta.get("needs_ocr") else 0,
                    doc_meta.get("storage_path"),
                    created_at,
                    now,
                ),
            )

            self.conn.execute("DELETE FROM chunks WHERE doc_id = ?", (doc_meta["id"],))
            for chunk in chunks:
                self.conn.execute(
                    """
                    INSERT INTO chunks (
                        id, doc_id, chunk_index, page_number, content, word_count, doc_version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        chunk.chunk_id,
                        chunk.doc_id,
                        chunk.chunk_index,
                        chunk.page_number,
                        chunk.content,
                        chunk.word_count,
                        chunk.doc_version,
                    ),
                )

        if self._collection is not None:
            self._collection.delete(where={"doc_id": doc_meta["id"]})
            if chunks:
                self._collection.add(
                    ids=[c.chunk_id for c in chunks],
                    embeddings=embeddings,
                    documents=[c.content for c in chunks],
                    metadatas=[
                        {
                            "doc_id": c.doc_id,
                            "filename": c.filename,
                            "domain": c.domain,
                            "file_type": c.file_type,
                            "page_number": c.page_number,
                            "doc_version": c.doc_version,
                        }
                        for c in chunks
                    ],
                )

    def delete_document(self, doc_id: str) -> bool:
        existing = self.get_document(doc_id)
        if not existing:
            return False
        with self.conn:
            self.conn.execute("DELETE FROM chunks WHERE doc_id = ?", (doc_id,))
            self.conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        if self._collection is not None:
            self._collection.delete(where={"doc_id": doc_id})
        return True

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        row = self.conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
        return dict(row) if row else None

    def list_documents(self) -> List[Dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM documents ORDER BY updated_at DESC, filename ASC"
        ).fetchall()
        return [dict(r) for r in rows]

    def list_all_chunks(self) -> List[Dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT c.*, d.filename, d.domain, d.file_type
            FROM chunks c
            INNER JOIN documents d ON d.id = c.doc_id
            WHERE d.status = 'indexed'
            ORDER BY d.filename ASC, c.chunk_index ASC
            """
        ).fetchall()
        return [dict(r) for r in rows]

    def query_chroma(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        where_filter: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        if self._collection is None or self._collection.count() == 0:
            return []
        kwargs: Dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "n_results": min(top_k, self._collection.count()),
            "include": ["documents", "metadatas", "distances"],
        }
        if where_filter:
            kwargs["where"] = where_filter
        res = self._collection.query(**kwargs)
        ids = res.get("ids", [[]])[0]
        docs = res.get("documents", [[]])[0]
        metas = res.get("metadatas", [[]])[0]
        dists = res.get("distances", [[]])[0]

        results = []
        for cid, content, meta, dist in zip(ids, docs, metas, dists):
            similarity = max(0.0, min(1.0, 1.0 - float(dist)))
            results.append(
                {
                    "chunk_id": cid,
                    "content": content,
                    "doc_id": meta["doc_id"],
                    "filename": meta["filename"],
                    "domain": meta["domain"],
                    "file_type": meta["file_type"],
                    "page_number": int(meta["page_number"]),
                    "doc_version": int(meta["doc_version"]),
                    "semantic_score": round(similarity, 4),
                }
            )
        return results

    def log_search(self, query: str, mode: str, top_score: float, result_count: int, has_gap: bool) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self.conn:
            self.conn.execute(
                """
                INSERT INTO search_logs (query, mode, top_score, result_count, has_gap, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (query, mode, float(top_score), int(result_count), 1 if has_gap else 0, now),
            )
