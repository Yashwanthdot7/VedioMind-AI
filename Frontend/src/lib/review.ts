import { Difficulty, QuizAttempt } from '../types';

/**
 * "Review my mistakes": every question answered wrong in a past quiz becomes
 *  - a question in a retry quiz, and
 *  - a flashcard on a spaced-repetition schedule (Leitner boxes).
 *
 * Mistakes come from the quiz history, so they follow the account across devices.
 * The card schedule is small and kept in this browser.
 */

export interface Mistake {
  key: string;
  question: string;
  options: string[] | null; // null for quizzes taken before options were saved
  answer: number;
  explanation: string | null;
  difficulty: Difficulty | null;
  source: string; // quiz title
  language: string;
  timesWrong: number;
  lastWrongAt: string;
  /** Answered right in a later quiz */
  fixed: boolean;
}

export const questionKey = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Wrong answers across all attempts, most recent first; a later right answer marks it fixed */
export function collectMistakes(attempts: QuizAttempt[]): Mistake[] {
  const byKey = new Map<string, Mistake>();
  const oldestFirst = [...attempts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const attempt of oldestFirst) {
    for (const a of attempt.answers) {
      const key = questionKey(a.question);
      if (!key) continue;
      const correct = a.correct ?? a.chosen === a.answer;
      const existing = byKey.get(key);
      if (correct) {
        if (existing) existing.fixed = true;
        continue;
      }
      const options = Array.isArray(a.options) && a.options.length >= 2 ? a.options : existing?.options ?? null;
      byKey.set(key, {
        key,
        question: a.question,
        options,
        answer: a.answer,
        explanation: a.explanation || existing?.explanation || null,
        difficulty: a.difficulty ?? existing?.difficulty ?? null,
        source: attempt.title,
        language: attempt.language,
        timesWrong: (existing?.timesWrong ?? 0) + 1,
        lastWrongAt: attempt.createdAt,
        fixed: false,
      });
    }
  }
  return [...byKey.values()].sort((a, b) => Number(a.fixed) - Number(b.fixed) || b.lastWrongAt.localeCompare(a.lastWrongAt));
}

const canAsk = (m: Mistake) => Boolean(m.options && m.options[m.answer] !== undefined);

/** A retry quiz: unfixed mistakes first, most-missed first, up to `max` questions */
export function retryQuestions(mistakes: Mistake[], max = 10) {
  return mistakes
    .filter(canAsk)
    .sort((a, b) => Number(a.fixed) - Number(b.fixed) || b.timesWrong - a.timesWrong || b.lastWrongAt.localeCompare(a.lastWrongAt))
    .slice(0, max)
    .map((m) => ({
      question: m.question,
      options: m.options as string[],
      answerIndex: m.answer,
      explanation: m.explanation || '',
      timestamp: '', // no video to jump to
      difficulty: m.difficulty,
    }));
}

// ------------------------------------------------------------ spaced repetition (Leitner)

/** Days until a card in box n comes back. Box 0 = new, box 5 = learned */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
export const LEARNED_BOX = 5;
const DAY = 24 * 60 * 60 * 1000;

export interface CardState {
  box: number;
  due: number; // epoch ms
}
export type Schedule = Record<string, CardState>;

export function cardState(schedule: Schedule, key: string): CardState {
  return schedule[key] ?? { box: 0, due: 0 };
}

/** Knew it: move up a box. Didn't: back to box 1, due again today */
export function gradeCard(schedule: Schedule, key: string, knew: boolean, now = Date.now()): Schedule {
  const current = cardState(schedule, key);
  const box = knew ? Math.min(current.box + 1, LEARNED_BOX) : 1;
  const due = knew ? startOfDay(now) + INTERVAL_DAYS[box] * DAY : now;
  return { ...schedule, [key]: { box, due } };
}

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Cards to review now: due, not yet learned, and with the answer text available */
export function dueCards(mistakes: Mistake[], schedule: Schedule, now = Date.now()): Mistake[] {
  return mistakes.filter((m) => {
    if (!canAsk(m)) return false;
    const s = cardState(schedule, m.key);
    return s.box < LEARNED_BOX && s.due <= now;
  });
}

export function reviewStats(mistakes: Mistake[], schedule: Schedule, now = Date.now()) {
  const askable = mistakes.filter(canAsk);
  return {
    total: mistakes.length,
    open: mistakes.filter((m) => !m.fixed).length,
    retryable: askable.length,
    due: dueCards(mistakes, schedule, now).length,
    learned: askable.filter((m) => cardState(schedule, m.key).box >= LEARNED_BOX).length,
    olderWithoutOptions: mistakes.length - askable.length,
  };
}

const storeKey = (scope: string) => `videomind.review.${scope}`;

export function loadSchedule(scope: string): Schedule {
  try {
    const raw = localStorage.getItem(storeKey(scope));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSchedule(scope: string, schedule: Schedule) {
  try {
    localStorage.setItem(storeKey(scope), JSON.stringify(schedule));
  } catch {
    /* storage unavailable */
  }
}
