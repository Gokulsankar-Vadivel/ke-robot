"""Multi-format text extraction (PDF via PyMuPDF, DOCX via python-docx, TXT) with page preservation."""

import io
import re
from dataclasses import dataclass, field
from typing import List, Optional

from modules.text_chunker import clean_text


@dataclass
class ExtractedPage:
    page_number: int
    text: str


@dataclass
class ExtractionOutput:
    ok: bool
    file_type: str
    page_count: int
    pages: List[ExtractedPage] = field(default_factory=list)
    needs_ocr: bool = False
    error_message: Optional[str] = None


def _split_logical_pages(raw_text: str, chars_per_page: int = 2400) -> List[ExtractedPage]:
    marker = re.compile(r"(?:^|\n)--- PAGE (\d+) ---\s*\n", re.IGNORECASE)
    matches = list(marker.finditer(raw_text))
    if matches:
        pages: List[ExtractedPage] = []
        preamble = clean_text(raw_text[: matches[0].start()])
        for idx, match in enumerate(matches):
            page_num = int(match.group(1))
            start = match.end()
            end = matches[idx + 1].start() if idx + 1 < len(matches) else len(raw_text)
            body = clean_text(raw_text[start:end])
            if idx == 0 and preamble:
                body = f"{preamble}\n\n{body}" if body else preamble
            if body:
                pages.append(ExtractedPage(page_number=page_num, text=body))
        return pages

    cleaned = clean_text(raw_text)
    if not cleaned:
        return []

    paragraphs = cleaned.split("\n\n")
    pages: List[ExtractedPage] = []
    buffer: List[str] = []
    current_len = 0
    page_num = 1

    for para in paragraphs:
        if current_len + len(para) > chars_per_page and buffer:
            pages.append(ExtractedPage(page_number=page_num, text="\n\n".join(buffer)))
            page_num += 1
            buffer = [para]
            current_len = len(para)
        else:
            buffer.append(para)
            current_len += len(para) + 2

    if buffer:
        pages.append(ExtractedPage(page_number=page_num, text="\n\n".join(buffer)))
    return pages


def extract_text_from_bytes(filename: str, content: bytes, extension: str) -> ExtractionOutput:
    ext = extension.lower()
    file_type = ext.lstrip(".")

    try:
        if ext == ".txt":
            if b"\x00" in content[:4096]:
                return ExtractionOutput(
                    ok=False,
                    file_type=file_type,
                    page_count=0,
                    error_message="Document processing failed. Please try another file.",
                )
            decoded = content.decode("utf-8", errors="strict")
            pages = _split_logical_pages(decoded)
            if not pages:
                return ExtractionOutput(
                    ok=False,
                    file_type=file_type,
                    page_count=0,
                    error_message="The uploaded text document is empty.",
                )
            return ExtractionOutput(ok=True, file_type=file_type, page_count=len(pages), pages=pages)

        if ext == ".docx":
            from docx import Document  # type: ignore

            doc = Document(io.BytesIO(content))
            full_text = "\n\n".join(p.text.strip() for p in doc.paragraphs if p.text.strip())
            pages = _split_logical_pages(full_text)
            if not pages:
                return ExtractionOutput(
                    ok=False,
                    file_type=file_type,
                    page_count=0,
                    error_message="The uploaded DOCX document contains no readable text.",
                )
            return ExtractionOutput(ok=True, file_type=file_type, page_count=len(pages), pages=pages)

        if ext == ".pdf":
            import fitz  # PyMuPDF

            pdf_doc = fitz.open(stream=content, filetype="pdf")
            total_pages = len(pdf_doc)
            if total_pages == 0:
                return ExtractionOutput(
                    ok=False,
                    file_type=file_type,
                    page_count=0,
                    error_message="The uploaded PDF contains zero pages.",
                )

            pages: List[ExtractedPage] = []
            total_chars = 0
            for idx in range(total_pages):
                page_text = clean_text(pdf_doc[idx].get_text("text"))
                total_chars += len(page_text)
                if page_text:
                    pages.append(ExtractedPage(page_number=idx + 1, text=page_text))

            avg_chars = total_chars / total_pages
            if total_chars == 0 or avg_chars < 25:
                return ExtractionOutput(
                    ok=False,
                    file_type=file_type,
                    page_count=total_pages,
                    needs_ocr=True,
                    error_message="Scanned PDF detected. OCR processing is required before indexing.",
                )

            return ExtractionOutput(
                ok=True, file_type=file_type, page_count=total_pages, pages=pages
            )

        return ExtractionOutput(
            ok=False,
            file_type=file_type,
            page_count=0,
            error_message="Please upload a supported document.",
        )

    except Exception:
        return ExtractionOutput(
            ok=False,
            file_type=file_type,
            page_count=0,
            error_message="Document processing failed. Please try another file.",
        )
