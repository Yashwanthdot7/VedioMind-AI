import { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useLearner } from '../../context/LearnerContext';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/errors';
import LearnerChoice from './LearnerChoice';

/** "How do you learn?": shown once after a sign-in that skipped it, and from the menu any time */
export default function LearnerSettings() {
  const { learner, needsSetup, settingsOpen, closeSettings, save } = useLearner();
  const { user } = useAuth();
  const [draft, setDraft] = useState(learner);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => { if (settingsOpen) { setDraft(learner); setError(null); } }, [settingsOpen, learner]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (settingsOpen && !d.open) d.showModal();
    if (!settingsOpen && d.open) d.close();
  }, [settingsOpen]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await save(draft);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={closeSettings}
      aria-labelledby="learner-title"
      className="w-[min(30rem,calc(100vw-2rem))] rounded-panel border border-ink-700 bg-ink-900 p-0 text-ink-100 backdrop:bg-ink-950/80"
    >
      <div className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 id="learner-title" className="text-2xl font-bold text-white">{needsSetup ? 'How do you learn?' : 'Learning profile'}</h2>
            <p className="mt-2 text-sm text-ink-400">
              Summaries, tutor answers, study tools and lessons adapt to this. You can still change the level for any one video or lesson.
              {!user && ' Saved in this browser; sign in to keep it on every device.'}
            </p>
          </div>
          <button onClick={closeSettings} className="p-1.5 text-ink-400 hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <LearnerChoice value={draft} onChange={setDraft} />
        {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={closeSettings} className="rounded-full px-4 py-2 text-sm text-ink-300 hover:text-white">{needsSetup ? 'Later' : 'Cancel'}</button>
          <button onClick={submit} disabled={busy} className="btn-neon px-5 py-2.5 text-sm">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </div>
    </dialog>
  );
}
