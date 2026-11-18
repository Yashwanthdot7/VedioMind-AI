import { Difficulty, QuizAttempt } from '../types';
import { GRADES, Grade, gradeFor } from './grades';

export type RangeFilter = '7d' | '30d' | 'all';
export type SourceFilter = 'all' | 'study' | 'lesson';

const DAY = 24 * 60 * 60 * 1000;

export function filterAttempts(list: QuizAttempt[], range: RangeFilter, source: SourceFilter): QuizAttempt[] {
  const since = range === 'all' ? 0 : Date.now() - (range === '7d' ? 7 : 30) * DAY;
  return list.filter((a) => (source === 'all' || a.source === source) && new Date(a.createdAt).getTime() >= since);
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Consecutive days (ending today or yesterday) with at least one quiz */
export function currentStreak(list: QuizAttempt[], now = new Date()): number {
  const days = new Set(list.map((a) => dayKey(new Date(a.createdAt))));
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface DifficultyStat {
  difficulty: Difficulty | 'unrated';
  correct: number;
  total: number;
  pct: number;
}

export interface Summary {
  count: number;
  averagePct: number;
  best: QuizAttempt | null;
  questions: number;
  correct: number;
  accuracyPct: number;
  streak: number;
  minutes: number;
  /** oldest → newest, for the trend line */
  trend: QuizAttempt[];
  byDifficulty: DifficultyStat[];
  grades: { grade: Grade; count: number }[];
  /** recent quizzes scored below B, newest first, one per title */
  toReview: QuizAttempt[];
}

export function summarise(list: QuizAttempt[]): Summary {
  const count = list.length;
  const averagePct = count ? Math.round(list.reduce((n, a) => n + a.scorePct, 0) / count) : 0;
  const best = list.reduce<QuizAttempt | null>((b, a) => (!b || a.scorePct > b.scorePct ? a : b), null);
  const questions = list.reduce((n, a) => n + a.total, 0);
  const correct = list.reduce((n, a) => n + a.correct, 0);
  const minutes = Math.round(list.reduce((n, a) => n + (a.durationSec || 0), 0) / 60);

  const diff = new Map<DifficultyStat['difficulty'], { correct: number; total: number }>();
  for (const a of list) {
    for (const ans of a.answers || []) {
      const key = ans.difficulty ?? 'unrated';
      const d = diff.get(key) ?? { correct: 0, total: 0 };
      d.total += 1;
      if (ans.correct ?? ans.chosen === ans.answer) d.correct += 1;
      diff.set(key, d);
    }
  }
  const order: DifficultyStat['difficulty'][] = ['easy', 'medium', 'hard', 'unrated'];
  const byDifficulty = order
    .filter((k) => diff.has(k))
    .map((k) => {
      const d = diff.get(k)!;
      return { difficulty: k, ...d, pct: Math.round((d.correct / d.total) * 100) };
    });

  const grades = GRADES.map((g) => ({ grade: g, count: list.filter((a) => (a.grade || gradeFor(a.scorePct)) === g).length }));

  const seen = new Set<string>();
  const toReview = [...list]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((a) => {
      if (seen.has(a.title)) return false;
      seen.add(a.title);
      return a.scorePct < 70;
    })
    .slice(0, 4);

  return {
    count,
    averagePct,
    best,
    questions,
    correct,
    accuracyPct: questions ? Math.round((correct / questions) * 100) : 0,
    streak: currentStreak(list),
    minutes,
    trend: [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-40),
    byDifficulty,
    grades,
    toReview,
  };
}
