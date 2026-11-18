import { supabase } from './supabase';
import { AttemptInput, QuizAttempt } from '../types';
import { clearAttemptsRemote, deleteAttemptRemote, listAttemptsRemote, saveAttemptRemote } from '../services/apiService';
import { gradeFor } from './grades';

/**
 * Quiz history: saved to Supabase when signed in, otherwise kept in this
 * browser (so analytics works without an account, e.g. for a demo).
 */

const LOCAL_KEY = 'videomind.quizAttempts';
const LOCAL_MAX = 300;

async function signedIn(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

function readLocal(): QuizAttempt[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(list: QuizAttempt[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, LOCAL_MAX)));
  } catch {
    /* storage unavailable or full */
  }
}

function scoreLocally(input: AttemptInput): QuizAttempt {
  const answers = input.answers.map((a) => ({ ...a, correct: a.chosen === a.answer }));
  const correct = answers.filter((a) => a.correct).length;
  const scorePct = Math.round((correct / answers.length) * 100);
  return {
    ...input,
    answers,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    total: answers.length,
    correct,
    scorePct,
    grade: gradeFor(scorePct),
    durationSec: Math.round(input.durationSec),
    createdAt: new Date().toISOString(),
  };
}

export type SaveResult = { attempt: QuizAttempt; where: 'account' | 'browser' };

/** Save a finished quiz. Falls back to this browser if the server can't save it. */
export async function recordAttempt(input: AttemptInput): Promise<SaveResult> {
  if (await signedIn()) {
    try {
      return { attempt: await saveAttemptRemote(input), where: 'account' };
    } catch (err) {
      console.warn('Saving quiz to account failed, keeping it in this browser:', err);
    }
  }
  const attempt = scoreLocally(input);
  writeLocal([attempt, ...readLocal()]);
  return { attempt, where: 'browser' };
}

export async function listAttempts(): Promise<{ attempts: QuizAttempt[]; where: 'account' | 'browser' }> {
  if (await signedIn()) {
    return { attempts: await listAttemptsRemote(), where: 'account' };
  }
  return { attempts: readLocal(), where: 'browser' };
}

export async function deleteAttempt(id: string): Promise<void> {
  if (id.startsWith('local-')) {
    writeLocal(readLocal().filter((a) => a.id !== id));
    return;
  }
  await deleteAttemptRemote(id);
}

export async function clearAttempts(where: 'account' | 'browser'): Promise<void> {
  if (where === 'browser') writeLocal([]);
  else await clearAttemptsRemote();
}

/** Attempts saved in this browser before signing in (offered for import) */
export function localAttemptCount(): number {
  return readLocal().length;
}

export async function importLocalAttempts(): Promise<number> {
  const local = readLocal();
  let imported = 0;
  for (const a of [...local].reverse()) {
    try {
      await saveAttemptRemote({
        source: a.source, kind: a.kind, title: a.title, language: a.language, level: a.level,
        analysisId: a.analysisId, lessonId: a.lessonId, videoId: a.videoId, answers: a.answers, durationSec: a.durationSec,
      });
      imported += 1;
    } catch {
      break;
    }
  }
  if (imported === local.length) writeLocal([]);
  return imported;
}
