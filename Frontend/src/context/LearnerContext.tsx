import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Learner, LearnerLevel, LearnerRole } from '../types';
import { getProfile, saveProfile, setLearnerHeader } from '../services/apiService';
import { useAuth } from './AuthContext';

/**
 * Who's learning: student (beginner / intermediate / advanced) or teacher.
 * Signed in: stored in the account profile. Guest: stored in this browser.
 * Every request carries it (X-Learner), so summaries, chat, study tools and lessons adapt.
 */

const GUEST_KEY = 'videomind.learner';
const DEFAULT: Learner = { role: 'student', level: 'intermediate' };

const ROLES: LearnerRole[] = ['student', 'teacher'];
const LEVELS: LearnerLevel[] = ['beginner', 'intermediate', 'advanced'];
const valid = (l: Partial<Learner> | null | undefined): Learner => ({
  role: ROLES.includes(l?.role as LearnerRole) ? (l!.role as LearnerRole) : DEFAULT.role,
  level: LEVELS.includes(l?.level as LearnerLevel) ? (l!.level as LearnerLevel) : DEFAULT.level,
});

function loadGuest(): Learner {
  try {
    return valid(JSON.parse(localStorage.getItem(GUEST_KEY) || 'null'));
  } catch {
    return DEFAULT;
  }
}

interface LearnerContextValue {
  learner: Learner;
  /** A signed-in user who hasn't chosen yet (e.g. after Google sign-in) */
  needsSetup: boolean;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  save: (learner: Learner) => Promise<void>;
}

const LearnerContext = createContext<LearnerContextValue | null>(null);

export function LearnerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [learner, setLearner] = useState<Learner>(loadGuest);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { setLearnerHeader(learner); }, [learner]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setLearner(loadGuest());
      setNeedsSetup(false);
      return;
    }
    getProfile()
      .then((p) => {
        if (cancelled) return;
        setLearner(valid(p));
        setNeedsSetup(!p.onboarded);
        if (!p.onboarded) setSettingsOpen(true);
      })
      .catch(() => {
        // Before migration 005 there is no profile endpoint data: use what sign-up stored
        if (cancelled) return;
        setLearner(valid(user.user_metadata as Partial<Learner>));
        setNeedsSetup(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  const save = useCallback(async (next: Learner) => {
    const clean = valid(next);
    if (user) await saveProfile(clean);
    else {
      try { localStorage.setItem(GUEST_KEY, JSON.stringify(clean)); } catch { /* storage unavailable */ }
    }
    setLearner(clean);
    setNeedsSetup(false);
    setSettingsOpen(false);
  }, [user]);

  const value = useMemo(() => ({
    learner, needsSetup, settingsOpen, save,
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
  }), [learner, needsSetup, settingsOpen, save]);

  return <LearnerContext.Provider value={value}>{children}</LearnerContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLearner(): LearnerContextValue {
  const ctx = useContext(LearnerContext);
  if (!ctx) throw new Error('useLearner must be used inside LearnerProvider');
  return ctx;
}
