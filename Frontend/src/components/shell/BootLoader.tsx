import { useEffect, useState } from 'react';

/** Only show the card if loading takes longer than this, so a fast start shows nothing at all */
const SHOW_AFTER_MS = 300;

/**
 * "Signing you in": shown only while the sign-in session is
 * really loading, and only when that takes long enough to notice. Never a timed effect.
 */
export default function BootLoader({ loading }: { loading: boolean }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (loading || !visible) return;
    setLeaving(true);
    const t = window.setTimeout(() => { setVisible(false); setLeaving(false); }, 300);
    return () => window.clearTimeout(t);
  }, [loading, visible]);

  if (!visible) return null;
  return (
    <div className={`fixed inset-0 z-[100] bg-ink-950 transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100'}`} role="status" aria-live="polite">
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col items-center px-8 py-10 text-center">
          <svg className="h-10 w-10 animate-spin text-neon-300" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <path d="M8 14 A14 14 0 0 1 32 14" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
          <p className="mt-6 text-2xl font-semibold text-ink-50">Getting your lessons ready</p>
          <p className="mt-2 text-ink-300">Signing you in…</p>
        </div>
      </div>
    </div>
  );
}
