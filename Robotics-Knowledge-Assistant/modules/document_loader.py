"""Document validation, hashing, and safe persistence loader."""

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from config import ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES, UPLOAD_DIR


@dataclass
class ValidationResult:
    valid: bool
    extension: str
    file_hash: str
    error_message: Optional[str] = None


def compute_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def validate_uploaded_file(filename: str, content: bytes) -> ValidationResult:
    ext = Path(filename).suffix.lower()
    file_hash = compute_sha256(content)

    if ext not in ALLOWED_EXTENSIONS:
        return ValidationResult(
            valid=False,
            extension=ext,
            file_hash=file_hash,
            error_message="Please upload a supported document (.pdf, .txt, or .docx).",
        )

    if len(content) == 0:
        return ValidationResult(
            valid=False,
            extension=ext,
            file_hash=file_hash,
            error_message="The uploaded file is empty.",
        )

    if len(content) > MAX_FILE_SIZE_BYTES:
        return ValidationResult(
            valid=False,
            extension=ext,
            file_hash=file_hash,
            error_message="File exceeds the 20 MB maximum upload limit.",
        )

    return ValidationResult(valid=True, extension=ext, file_hash=file_hash)


def save_uploaded_bytes(doc_id: str, filename: str, content: bytes) -> Path:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in Path(filename).name)
    target = UPLOAD_DIR / f"{doc_id}_{safe_name}"
    target.write_bytes(content)
    return target
