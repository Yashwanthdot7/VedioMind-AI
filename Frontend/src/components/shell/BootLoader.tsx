import { useEffect, useState } from 'react';
import PortalArt from '../art/PortalArt';

const SEEN_KEY = 'videomind.booted';

/**
 * "Initializing session": shown over the portal while the account session loads,
 * and briefly once per browser session so the first visit opens on the art.
 */
export default function BootLoader({ loading }: { loading: boolean }) {
  const [minTimeDone, setMinTimeDone] = useState(() => {
    try {
      return sessionStorage.getItem(SEEN_KEY) === '1' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return true;
    }
  });
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (minTimeDone) return;
    const t = window.setTimeout(() => {
      setMinTimeDone(true);
      try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    }, 1100);
    return () => window.clearTimeout(t);
  }, [minTimeDone]);

  const ready = minTimeDone && !loading;
  useEffect(() => {
    if (!ready) return;
    setLeaving(true);
    const t = window.setTimeout(() => setGone(true), 450);
    return () => window.clearTimeout(t);
  }, [ready]);

  if (gone) return null;
  return (
    <div className={`fixed inset-0 z-[100] transition-opacity duration-500 ${leaving ? 'opacity-0' : 'opacity-100'}`} role="status" aria-live="polite">
      <PortalArt dim focusX={50} />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="glass flex w-full max-w-sm flex-col items-center rounded-2xl px-8 py-10 text-center">
          <svg className="h-10 w-10 animate-spin text-neon-300" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <path d="M8 14 A14 14 0 0 1 32 14" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
          <p className="mt-6 text-2xl font-semibold text-ink-50">Initializing session</p>
          <p className="mt-2 text-ink-300">Setting up your study space…</p>
        </div>
      </div>
    </div>
  );
}
