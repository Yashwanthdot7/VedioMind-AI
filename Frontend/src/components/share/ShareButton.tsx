import { useEffect, useRef, useState } from 'react';
import { Share2, Copy, Check, X, Loader2, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { setSharing, shareUrl } from '../../services/apiService';
import { errorMessage } from '../../lib/errors';

interface ShareButtonProps {
  kind: 'lesson' | 'course';
  id: string;
  title: string;
  isPublic: boolean;
  shareSlug: string | null;
  onChange?: (state: { isPublic: boolean; shareSlug: string | null }) => void;
}

/** "Share with class": turn a public link on or off, copy it, or show a QR code to the class */
export default function ShareButton({ kind, id, title, isPublic, shareSlug, onChange }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ isPublic, shareSlug });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => { setState({ isPublic, shareSlug }); }, [isPublic, shareSlug]);

  const link = state.isPublic && state.shareSlug ? shareUrl(state.shareSlug) : null;

  useEffect(() => {
    if (!link) { setQr(null); return; }
    QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: '#15132B', light: '#FFFFFF' } }).then(setQr).catch(() => setQr(null));
  }, [link]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const toggle = async (next: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await setSharing(kind, id, next);
      const updated = { isPublic: res.isPublic, shareSlug: res.shareSlug };
      setState(updated);
      onChange?.(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Copying is blocked in this browser. Select the link and copy it.');
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm transition-colors ${
          state.isPublic ? 'border-lagoon-500/50 text-lagoon-300 hover:border-lagoon-400' : 'border-ink-700 text-ink-200 hover:border-turmeric-400/60'
        }`}
      >
        <Share2 className="w-4 h-4" /> {state.isPublic ? 'Shared with class' : 'Share with class'}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === dialogRef.current) setOpen(false); }}
        className="w-[min(32rem,calc(100vw-2rem))] rounded-panel bg-ink-900 text-ink-100 border border-ink-700 p-0 backdrop:bg-ink-950/80"
        aria-labelledby="share-title"
      >
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 id="share-title" className="font-semiwide text-xl font-bold text-ink-50">Share with your class</h2>
              <p className="text-sm text-ink-400 mt-1 truncate">{title}</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-ink-400 hover:text-ink-100" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-ink-700 cursor-pointer">
            <input
              type="checkbox"
              checked={state.isPublic}
              disabled={busy}
              onChange={(e) => toggle(e.target.checked)}
              className="mt-1 w-4 h-4 accent-turmeric-400"
            />
            <span>
              <span className="block text-sm font-medium text-ink-100">Anyone with the link can watch</span>
              <span className="block text-xs text-ink-400 mt-0.5">
                Students don't need an account. They can take the quiz, but they can't change or delete anything.
                {kind === 'course' ? ' Every module is included.' : ''}
              </span>
            </span>
            {busy && <Loader2 className="w-4 h-4 animate-spin text-turmeric-400 ml-auto mt-1" />}
          </label>

          {link ? (
            <>
              <div className="flex gap-2">
                <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Class link"
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-ink-950 border border-ink-700 text-sm text-ink-200" />
                <button onClick={copy} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-turmeric-400 hover:bg-turmeric-300 text-ink-950 text-sm font-semibold">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
              {qr && (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <img src={qr} alt="QR code for the class link" className="w-40 h-40 rounded-xl bg-white p-2" />
                  <div className="text-sm text-ink-400 space-y-3">
                    <p>Show this on the projector. Students scan it with their phone camera to open the {kind}.</p>
                    <a href={qr} download={`${title.slice(0, 40) || 'videomind'}-qr.png`} className="inline-flex items-center gap-1.5 text-turmeric-300 hover:text-turmeric-200">
                      <Download className="w-4 h-4" /> Download QR code
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-500">The link is off. Only you can open this {kind}.</p>
          )}

          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
        </div>
      </dialog>
    </>
  );
}
