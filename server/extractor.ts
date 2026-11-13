import crypto from 'node:crypto';
import path from 'node:path';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { APP_CONFIG } from './config';
import { cleanText, type PageText } from './chunker';

export interface ExtractionResult {
  ok: boolean;
  fileType: 'pdf' | 'txt' | 'docx';
  fileHash: string;
  pageCount: number;
  pages: PageText[];
  needsOcr: boolean;
  errorMessage?: string;
}

export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function validateUploadFile(
  filename: string,
  sizeBytes: number,
): { valid: boolean; ext: '.pdf' | '.txt' | '.docx' | null; error?: string } {
  const ext = path.extname(filename).toLowerCase();
  if (!APP_CONFIG.allowedExtensions.includes(ext as '.pdf' | '.txt' | '.docx')) {
    return {
      valid: false,
      ext: null,
      error: 'Please upload a supported document (.pdf, .txt, or .docx).',
    };
  }
  if (sizeBytes <= 0) {
    return {
      valid: false,
      ext: ext as '.pdf' | '.txt' | '.docx',
      error: 'The uploaded document is empty. Please upload a file with readable text.',
    };
  }
  if (sizeBytes > APP_CONFIG.maxFileSizeBytes) {
    return {
      valid: false,
      ext: ext as '.pdf' | '.txt' | '.docx',
      error: 'File exceeds the 20 MB maximum upload size.',
    };
  }
  return { valid: true, ext: ext as '.pdf' | '.txt' | '.docx' };
}

function splitIntoLogicalPages(fullText: string, charsPerPage = 2400): PageText[] {
  const markerRegex = /(?:^|\n)--- PAGE (\d+) ---\s*\n/gi;
  const matches = Array.from(fullText.matchAll(markerRegex));

  if (matches.length > 0) {
    const pages: PageText[] = [];
    const preamble = cleanText(fullText.slice(0, matches[0].index ?? 0));

    for (let i = 0; i < matches.length; i += 1) {
      const m = matches[i];
      const pageNum = Number(m[1]) || i + 1;
      const start = (m.index ?? 0) + m[0].length;
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? fullText.length) : fullText.length;
      let body = cleanText(fullText.slice(start, end));
      if (i === 0 && preamble) {
        body = `${preamble}\n\n${body}`;
      }
      if (body) {
        pages.push({ pageNumber: pageNum, text: body });
      }
    }
    return pages;
  }

  const cleaned = cleanText(fullText);
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n\n+/);
  const pages: PageText[] = [];
  let buffer = '';
  let pageNumber = 1;

  for (const para of paragraphs) {
    if (buffer.length + para.length + 2 > charsPerPage && buffer.length > 0) {
      pages.push({ pageNumber, text: buffer.trim() });
      pageNumber += 1;
      buffer = para;
    } else {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    }
  }
  if (buffer.trim()) {
    pages.push({ pageNumber, text: buffer.trim() });
  }
  return pages;
}

export async function extractDocumentContent(
  filename: string,
  buffer: Buffer,
): Promise<ExtractionResult> {
  const validation = validateUploadFile(filename, buffer.length);
  const fileHash = computeFileHash(buffer);

  if (!validation.valid || !validation.ext) {
    return {
      ok: false,
      fileType: 'txt',
      fileHash,
      pageCount: 0,
      pages: [],
      needsOcr: false,
      errorMessage: validation.error || 'Please upload a supported document.',
    };
  }

  const fileType = validation.ext.slice(1) as 'pdf' | 'txt' | 'docx';

  try {
    if (fileType === 'txt') {
      // Reject obvious binary payloads masquerading as .txt
      const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
      let nullCount = 0;
      for (const byte of sample) {
        if (byte === 0) nullCount += 1;
      }
      if (nullCount > 2) {
        return {
          ok: false,
          fileType,
          fileHash,
          pageCount: 0,
          pages: [],
          needsOcr: false,
          errorMessage: 'Document processing failed. The text file appears corrupted or binary.',
        };
      }

      const rawText = buffer.toString('utf8');
      const pages = splitIntoLogicalPages(rawText);
      if (pages.length === 0) {
        return {
          ok: false,
          fileType,
          fileHash,
          pageCount: 0,
          pages: [],
          needsOcr: false,
          errorMessage: 'The uploaded text document contains no readable content.',
        };
      }

      return {
        ok: true,
        fileType,
        fileHash,
        pageCount: pages.length,
        pages,
        needsOcr: false,
      };
    }

    if (fileType === 'docx') {
      const result = await mammoth.extractRawText({ buffer });
      const pages = splitIntoLogicalPages(result.value || '');
      if (pages.length === 0) {
        return {
          ok: false,
          fileType,
          fileHash,
          pageCount: 0,
          pages: [],
          needsOcr: false,
          errorMessage: 'The uploaded DOCX document contains no extractable text.',
        };
      }
      return {
        ok: true,
        fileType,
        fileHash,
        pageCount: pages.length,
        pages,
        needsOcr: false,
      };
    }

    // PDF extraction via pdfjs-dist preserving exact page numbers
    const uint8 = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      useWorkerFetch: false,
      verbosity: 0,
    });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    if (totalPages === 0) {
      return {
        ok: false,
        fileType,
        fileHash,
        pageCount: 0,
        pages: [],
        needsOcr: false,
        errorMessage: 'The uploaded PDF has zero pages.',
      };
    }

    const pages: PageText[] = [];
    let totalExtractedChars = 0;

    for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const strings = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean);
      const pageText = cleanText(strings.join(' '));
      totalExtractedChars += pageText.length;
      if (pageText) {
        pages.push({ pageNumber: pageNum, text: pageText });
      }
    }

    // Detect scanned PDFs requiring OCR (< 25 chars/page average)
    const avgCharsPerPage = totalExtractedChars / totalPages;
    if (totalExtractedChars === 0 || avgCharsPerPage < 25) {
      return {
        ok: false,
        fileType,
        fileHash,
        pageCount: totalPages,
        pages: [],
        needsOcr: true,
        errorMessage:
          'Scanned PDF detected (no selectable text layer). Optical Character Recognition (OCR) is required before indexing.',
      };
    }

    return {
      ok: true,
      fileType,
      fileHash,
      pageCount: totalPages,
      pages,
      needsOcr: false,
    };
  } catch (err) {
    console.error('[extractor] failed to parse document:', filename, err);
    return {
      ok: false,
      fileType,
      fileHash,
      pageCount: 0,
      pages: [],
      needsOcr: false,
      errorMessage: 'Document processing failed. Please try another file.',
    };
  }
}
