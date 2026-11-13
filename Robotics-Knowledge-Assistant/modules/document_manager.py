"""Document lifecycle manager: ingest, duplicate check, versioned update, re-index, and delete."""

import hashlib
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from config import DEFAULT_CHUNK_OVERLAP, DEFAULT_CHUNK_SIZE, SAMPLE_DOCS_DIR
from modules.document_loader import save_uploaded_bytes, validate_uploaded_file
from modules.embedding_manager import EmbeddingManager
from modules.text_chunker import chunk_pages
from modules.text_extractor import extract_text_from_bytes
from modules.vector_database import VectorDatabase


class DocumentManager:
    def __init__(self, db: VectorDatabase, embedder: EmbeddingManager) -> None:
        self.db = db
        self.embedder = embedder

    def ingest_bytes(
        self,
        filename: str,
        content: bytes,
        domain: str = "Robotics Fundamentals",
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
    ) -> Dict[str, Any]:
        validation = validate_uploaded_file(filename, content)
        if not validation.valid:
            return {"status": "failed", "message": validation.error_message}

        dup = self.db.find_duplicate_by_hash(validation.file_hash)
        if dup:
            return {
                "status": "duplicate",
                "message": f"Duplicate document detected (matches '{dup['filename']}').",
                "document": dup,
            }

        doc_id = f"doc_{uuid.uuid4().hex[:12]}"
        extracted = extract_text_from_bytes(filename, content, validation.extension)

        if not extracted.ok:
            status = "ocr_required" if extracted.needs_ocr else "failed"
            self.db.upsert_document(
                {
                    "id": doc_id,
                    "filename": Path(filename).name,
                    "file_type": extracted.file_type,
                    "file_size": len(content),
                    "file_hash": validation.file_hash,
                    "domain": domain,
                    "version": 1,
                    "page_count": extracted.page_count,
                    "status": status,
                    "error_message": extracted.error_message,
                    "needs_ocr": extracted.needs_ocr,
                    "storage_path": None,
                },
                chunks=[],
                embeddings=[],
            )
            return {"status": status, "message": extracted.error_message}

        saved_path = save_uploaded_bytes(doc_id, filename, content)
        chunks = chunk_pages(
            extracted.pages,
            doc_id=doc_id,
            filename=Path(filename).name,
            domain=domain,
            file_type=extracted.file_type,
            doc_version=1,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        embeddings = self.embedder.embed_documents([c.content for c in chunks])

        self.db.upsert_document(
            {
                "id": doc_id,
                "filename": Path(filename).name,
                "file_type": extracted.file_type,
                "file_size": len(content),
                "file_hash": validation.file_hash,
                "domain": domain,
                "version": 1,
                "page_count": extracted.page_count,
                "status": "indexed",
                "error_message": None,
                "needs_ocr": False,
                "storage_path": str(saved_path),
            },
            chunks=chunks,
            embeddings=embeddings,
        )
        return {
            "status": "indexed",
            "message": "Document uploaded successfully.",
            "document": self.db.get_document(doc_id),
        }

    def update_document(
        self,
        doc_id: str,
        new_content: bytes,
        new_filename: Optional[str] = None,
        domain: Optional[str] = None,
    ) -> Dict[str, Any]:
        existing = self.db.get_document(doc_id)
        if not existing:
            return {"status": "failed", "message": "Document not found."}

        filename = new_filename or existing["filename"]
        validation = validate_uploaded_file(filename, new_content)
        if not validation.valid:
            return {"status": "failed", "message": validation.error_message}

        dup = self.db.find_duplicate_by_hash(validation.file_hash, exclude_doc_id=doc_id)
        if dup:
            return {"status": "duplicate", "message": f"Matches existing document '{dup['filename']}'."}

        extracted = extract_text_from_bytes(filename, new_content, validation.extension)
        if not extracted.ok:
            return {"status": "failed", "message": extracted.error_message}

        next_version = int(existing["version"]) + 1
        saved_path = save_uploaded_bytes(doc_id, filename, new_content)
        target_domain = domain or existing["domain"]

        chunks = chunk_pages(
            extracted.pages,
            doc_id=doc_id,
            filename=Path(filename).name,
            domain=target_domain,
            file_type=extracted.file_type,
            doc_version=next_version,
        )
        embeddings = self.embedder.embed_documents([c.content for c in chunks])

        self.db.upsert_document(
            {
                "id": doc_id,
                "filename": Path(filename).name,
                "file_type": extracted.file_type,
                "file_size": len(new_content),
                "file_hash": validation.file_hash,
                "domain": target_domain,
                "version": next_version,
                "page_count": extracted.page_count,
                "status": "indexed",
                "error_message": None,
                "needs_ocr": False,
                "storage_path": str(saved_path),
            },
            chunks=chunks,
            embeddings=embeddings,
        )
        return {
            "status": "indexed",
            "message": "Document updated successfully.",
            "document": self.db.get_document(doc_id),
        }

    def delete_document(self, doc_id: str) -> bool:
        doc = self.db.get_document(doc_id)
        if not doc:
            return False
        storage_path = doc.get("storage_path")
        deleted = self.db.delete_document(doc_id)
        if deleted and storage_path:
            p = Path(storage_path)
            if p.exists() and "uploads" in p.parts:
                p.unlink(missing_ok=True)
        return deleted

    def seed_samples_if_empty(self) -> int:
        if self.db.list_documents():
            return 0
        if not SAMPLE_DOCS_DIR.exists():
            return 0
        count = 0
        for sample in sorted(SAMPLE_DOCS_DIR.glob("*.txt")):
            res = self.ingest_bytes(sample.name, sample.read_bytes(), domain="Robotics Fundamentals")
            if res.get("status") == "indexed":
                count += 1
        return count
