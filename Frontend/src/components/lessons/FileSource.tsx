import { DragEvent, useRef, useState } from 'react';
import { FileUp, FileText, Loader2, X } from 'lucide-react';
import { ACCEPTED, ExtractError, Extracted, extractText, fileKind, pdfPageCount } from '../../lib/extractText';

export interface UploadedFile extends Extracted {
  name: string;
}

interface FileSourceProps {
  file: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  maxChars: number;
}

/** Upload a PDF, Word or text file; its text becomes the lesson material */
export default function FileSource({ file, onChange, maxChars }: FileSourceProps) {
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [range, setRange] = useState<[number, number]>([1, 1]);

  const read = async (f: File, pages?: [number, number]) => {
    setBusy(true);
    setError(null);
    try {
      const out = await extractText(f, pages);
      onChange({ ...out, name: f.name });
      if (out.pagesRead) setRange(out.pagesRead);
    } catch (err) {
      setError(err instanceof ExtractError ? err.message : 'This file could not be read. Try another file or paste the text.');
      onChange(null);
    } finally {
      setBusy(false);
    }
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!fileKind(f)) { setError('Pick a PDF, a Word file (.docx), or a text file.'); return; }
    setPicked(f);
    // Long PDFs: start with the first 30 pages; the teacher can pick the chapter
    if (fileKind(f) === 'pdf') {
      try {
        const n = await pdfPageCount(f);
        return read(f, [1, Math.min(n, 30)]);
      } catch {
        /* read() reports the problem */
      }
    }
    return read(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const clear = () => {
    setPicked(null);
    setError(null);
    onChange(null);
    if (input.current) input.current.value = '';
  };

  const tooLong = file ? file.text.length > maxChars : false;

  return (
    <div className="space-y-3">
      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed text-center transition-colors ${
            dragging ? 'border-turmeric-400 bg-turmeric-500/5' : 'border-ink-700'
          }`}
        >
          {busy ? <Loader2 className="w-8 h-8 text-turmeric-400 animate-spin" /> : <FileUp className="w-8 h-8 text-ink-500" />}
          <p className="text-ink-200">{busy ? 'Reading the file…' : 'Drop a PDF, Word or text file here'}</p>
          <p className="text-xs text-ink-500">A textbook chapter, class notes or an article. The text is read on your device, so the file is never uploaded.</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-ink-600 text-sm text-ink-100 hover:border-turmeric-400/60 disabled:opacity-50"
          >
            Choose a file
          </button>
          <input ref={input} type="file" accept={ACCEPTED} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label="Choose a file" />
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-ink-950/60 border border-ink-700/50 space-y-3">
          <div className="flex items-start gap-3">
            <FileText className="w-6 h-6 text-turmeric-300 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-100 truncate">{file.name}</p>
              <p className="text-xs text-ink-500 mt-0.5">
                {file.pageCount ? `Pages ${file.pagesRead?.[0]}–${file.pagesRead?.[1]} of ${file.pageCount}, ` : ''}
                {file.text.length.toLocaleString()} characters of text
              </p>
            </div>
            <button type="button" onClick={clear} className="p-1.5 rounded-lg text-ink-500 hover:text-ink-200" aria-label="Remove file">
              <X className="w-4 h-4" />
            </button>
          </div>

          {file.pageCount && file.pageCount > 1 && picked && (
            <form
              className="flex flex-wrap items-end gap-2 text-sm"
              onSubmit={(e) => { e.preventDefault(); read(picked, range); }}
            >
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ink-400">From page</span>
                <input type="number" min={1} max={file.pageCount} value={range[0]}
                  onChange={(e) => setRange([Number(e.target.value), range[1]])}
                  className="w-24 px-2.5 py-1.5 rounded-lg bg-ink-950 border border-ink-700 text-ink-100" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ink-400">To page</span>
                <input type="number" min={1} max={file.pageCount} value={range[1]}
                  onChange={(e) => setRange([range[0], Number(e.target.value)])}
                  className="w-24 px-2.5 py-1.5 rounded-lg bg-ink-950 border border-ink-700 text-ink-100" />
              </label>
              <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-lg border border-ink-600 text-ink-100 hover:border-turmeric-400/60 disabled:opacity-50">
                {busy ? 'Reading…' : 'Use these pages'}
              </button>
            </form>
          )}

          <p className="text-xs text-ink-400 line-clamp-4 whitespace-pre-line border-l-2 border-ink-700 pl-3">{file.text.slice(0, 600)}</p>
          {tooLong && (
            <p className="text-xs text-amber-300">
              That's more than {maxChars.toLocaleString()} characters, so only the start will be used. Pick fewer pages, or one chapter.
            </p>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
    </div>
  );
}
