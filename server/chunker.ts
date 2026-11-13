export interface PageText {
  pageNumber: number;
  text: string;
}

export interface TextChunk {
  id: string;
  docId: string;
  filename: string;
  domain: string;
  fileType: string;
  docVersion: number;
  chunkIndex: number;
  pageNumber: number;
  content: string;
  wordCount: number;
}

/**
 * Normalizes raw extracted text while preserving paragraph boundaries.
 */
export function cleanText(raw: string): string {
  return raw
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Splits a single paragraph that exceeds chunkSize into sentence-aligned pieces.
 */
function splitLongParagraph(paragraph: string, chunkSize: number): string[] {
  if (paragraph.length <= chunkSize) return [paragraph];

  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  const parts: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (!sentence) continue;
    if (sentence.length > chunkSize) {
      if (current) {
        parts.push(current.trim());
        current = '';
      }
      // Hard word-boundary split for unusually long unbroken lines
      const words = sentence.split(/\s+/);
      let wordBuf = '';
      for (const word of words) {
        if (wordBuf.length + word.length + 1 > chunkSize && wordBuf) {
          parts.push(wordBuf.trim());
          wordBuf = word;
        } else {
          wordBuf = wordBuf ? `${wordBuf} ${word}` : word;
        }
      }
      if (wordBuf) parts.push(wordBuf.trim());
      continue;
    }

    if (current.length + sentence.length + 1 > chunkSize && current) {
      parts.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Paragraph-aware chunker that preserves original page numbers, metadata, and overlap.
 */
export function chunkPages(
  pages: PageText[],
  meta: {
    docId: string;
    filename: string;
    domain: string;
    fileType: string;
    docVersion: number;
  },
  chunkSize = 750,
  chunkOverlap = 130,
): TextChunk[] {
  const safeChunkSize = Math.max(200, chunkSize);
  const safeOverlap = Math.min(Math.max(0, chunkOverlap), Math.floor(safeChunkSize * 0.45));

  const chunks: TextChunk[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    const cleaned = cleanText(page.text);
    if (!cleaned) continue;

    const rawParagraphs = cleaned
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const paragraphs: string[] = [];
    for (const para of rawParagraphs) {
      paragraphs.push(...splitLongParagraph(para, safeChunkSize));
    }

    let buffer = '';

    const flushBuffer = (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
      chunks.push({
        id: `${meta.docId}_v${meta.docVersion}_p${page.pageNumber}_c${globalIndex}`,
        docId: meta.docId,
        filename: meta.filename,
        domain: meta.domain,
        fileType: meta.fileType,
        docVersion: meta.docVersion,
        chunkIndex: globalIndex,
        pageNumber: page.pageNumber,
        content: trimmed,
        wordCount,
      });
      globalIndex += 1;
    };

    for (const para of paragraphs) {
      const candidate = buffer ? `${buffer}\n\n${para}` : para;
      if (candidate.length <= safeChunkSize) {
        buffer = candidate;
      } else {
        if (buffer) {
          flushBuffer(buffer);
          if (safeOverlap > 0 && buffer.length > safeOverlap) {
            const tail = buffer.slice(buffer.length - safeOverlap);
            const firstSpace = tail.indexOf(' ');
            const overlapText = firstSpace > 0 ? tail.slice(firstSpace + 1).trim() : tail.trim();
            buffer = overlapText ? `${overlapText}\n\n${para}` : para;
            if (buffer.length > safeChunkSize) {
              flushBuffer(buffer);
              buffer = '';
            }
          } else {
            buffer = para;
          }
        } else {
          flushBuffer(para);
          buffer = '';
        }
      }
    }

    if (buffer.trim()) {
      flushBuffer(buffer);
    }
  }

  return chunks;
}
