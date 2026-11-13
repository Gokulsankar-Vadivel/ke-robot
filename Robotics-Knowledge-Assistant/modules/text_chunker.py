"""Paragraph-aware text cleaning and chunking with page metadata preservation."""

import re
from dataclasses import dataclass
from typing import List


@dataclass
class TextChunk:
    chunk_id: str
    doc_id: str
    filename: str
    domain: str
    file_type: str
    doc_version: int
    chunk_index: int
    page_number: int
    content: str
    word_count: int


def clean_text(raw: str) -> str:
    text = raw.replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def _split_long_paragraph(paragraph: str, chunk_size: int) -> List[str]:
    if len(paragraph) <= chunk_size:
        return [paragraph]

    sentences = re.split(r"(?<=[.!?])\s+", paragraph)
    parts: List[str] = []
    current = ""

    for sentence in sentences:
        if not sentence:
            continue
        if len(sentence) > chunk_size:
            if current:
                parts.append(current.strip())
                current = ""
            words = sentence.split()
            buf = ""
            for word in words:
                if len(buf) + len(word) + 1 > chunk_size and buf:
                    parts.append(buf.strip())
                    buf = word
                else:
                    buf = f"{buf} {word}".strip()
            if buf:
                parts.append(buf.strip())
            continue

        if len(current) + len(sentence) + 1 > chunk_size and current:
            parts.append(current.strip())
            current = sentence
        else:
            current = f"{current} {sentence}".strip()

    if current.strip():
        parts.append(current.strip())
    return parts


def chunk_pages(
    pages: list,
    doc_id: str,
    filename: str,
    domain: str,
    file_type: str,
    doc_version: int = 1,
    chunk_size: int = 750,
    chunk_overlap: int = 130,
) -> List[TextChunk]:
    safe_size = max(200, chunk_size)
    safe_overlap = min(max(0, chunk_overlap), int(safe_size * 0.45))

    chunks: List[TextChunk] = []
    global_idx = 0

    for page in pages:
        cleaned = clean_text(page.text)
        if not cleaned:
            continue

        paragraphs: List[str] = []
        for para in re.split(r"\n\n+", cleaned):
            para = para.strip()
            if para:
                paragraphs.extend(_split_long_paragraph(para, safe_size))

        buffer = ""

        def flush(text: str) -> None:
            nonlocal global_idx
            trimmed = text.strip()
            if not trimmed:
                return
            chunks.append(
                TextChunk(
                    chunk_id=f"{doc_id}_v{doc_version}_p{page.page_number}_c{global_idx}",
                    doc_id=doc_id,
                    filename=filename,
                    domain=domain,
                    file_type=file_type,
                    doc_version=doc_version,
                    chunk_index=global_idx,
                    page_number=page.page_number,
                    content=trimmed,
                    word_count=len(trimmed.split()),
                )
            )
            global_idx += 1

        for para in paragraphs:
            candidate = f"{buffer}\n\n{para}" if buffer else para
            if len(candidate) <= safe_size:
                buffer = candidate
            else:
                if buffer:
                    flush(buffer)
                    if safe_overlap > 0 and len(buffer) > safe_overlap:
                        tail = buffer[-safe_overlap:]
                        first_space = tail.find(" ")
                        overlap_text = tail[first_space + 1 :].strip() if first_space > 0 else tail.strip()
                        buffer = f"{overlap_text}\n\n{para}" if overlap_text else para
                        if len(buffer) > safe_size:
                            flush(buffer)
                            buffer = ""
                    else:
                        buffer = para
                else:
                    flush(para)
                    buffer = ""

        if buffer.strip():
            flush(buffer)

    return chunks
