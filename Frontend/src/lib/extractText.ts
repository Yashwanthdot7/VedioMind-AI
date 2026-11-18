/**
 * Pull the text out of an uploaded file, in the browser (nothing is uploaded, nothing costs money).
 * PDF: pdf.js. Word (.docx): mammoth. Plain text and Markdown: read directly.
 * The libraries are loaded only when a file is picked, so the app itself stays light.
 */

export const ACCEPTED = '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown';
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type FileKind = 'pdf' | 'docx' | 'text';

export interface Extracted {
  kind: FileKind;
  text: string;
  /** PDFs only */
  pageCount?: number;
  pagesRead?: [number, number];
}

export class ExtractError extends Error {}

export function fileKind(file: File): FileKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) return 'text';
  return null;
}

/** Undo the line breaks a PDF puts in the middle of sentences and words */
export function tidy(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2') // hyphenated across lines: "photo-\nsynthesis"
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/([^\n.!?:।])\n(?!\n)/gu, '$1 ') // a single break inside a sentence
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/** Number of pages, without reading the text */
export async function pdfPageCount(file: File): Promise<number> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    return (await task.promise).numPages;
  } finally {
    await task.destroy();
  }
}

async function extractPdf(file: File, range?: [number, number]): Promise<Extracted> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    await task.destroy();
    const name = (err as { name?: string })?.name;
    if (name === 'PasswordException') throw new ExtractError('This PDF is password-protected. Save a copy without a password and try again.');
    throw new ExtractError('This file could not be read as a PDF.');
  }
  try {
    const from = Math.max(1, Math.min(range?.[0] ?? 1, doc.numPages));
    const to = Math.max(from, Math.min(range?.[1] ?? doc.numPages, doc.numPages));
    const pages: string[] = [];
    for (let p = from; p <= to; p += 1) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let line = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        line += item.str + (item.hasEOL ? '\n' : '');
      }
      pages.push(line);
      page.cleanup();
    }
    const text = tidy(pages.join('\n\n'));
    if (text.replace(/\s/g, '').length < 40) {
      throw new ExtractError('No text was found in these pages. The PDF is probably scanned images, which can\'t be read here. Try a PDF with selectable text, or paste the text.');
    }
    return { kind: 'pdf', text, pageCount: doc.numPages, pagesRead: [from, to] };
  } finally {
    await task.destroy();
  }
}

async function extractDocx(file: File): Promise<Extracted> {
  const mammoth = await import('mammoth');
  try {
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { kind: 'docx', text: tidy(value) };
  } catch {
    throw new ExtractError('This file could not be read as a Word document (.docx). Older .doc files need to be saved as .docx first.');
  }
}

export async function extractText(file: File, range?: [number, number]): Promise<Extracted> {
  if (file.size > MAX_FILE_BYTES) throw new ExtractError('This file is over 25 MB. Try a single chapter.');
  const kind = fileKind(file);
  if (!kind) throw new ExtractError('Pick a PDF, a Word file (.docx), or a text file.');
  if (kind === 'pdf') return extractPdf(file, range);
  if (kind === 'docx') return extractDocx(file);
  return { kind: 'text', text: tidy(await file.text()) };
}
