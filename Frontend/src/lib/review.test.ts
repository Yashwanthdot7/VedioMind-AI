import { describe, expect, it } from 'vitest';
import { QuizAttempt } from '../types';
import { collectMistakes, dueCards, gradeCard, INTERVAL_DAYS, LEARNED_BOX, retryQuestions, reviewStats } from './review';

const opts = ['Lava', 'Ash', 'Steam', 'Ice'];
const attempt = (createdAt: string, answers: QuizAttempt['answers'], title = 'Volcanoes'): QuizAttempt => ({
  id: createdAt, source: 'study', kind: 'quiz', title, language: 'en', answers, durationSec: 10,
  total: answers.length, correct: answers.filter((a) => a.chosen === a.answer).length, scorePct: 0, grade: 'D', createdAt,
});
const wrong = (question: string, withOptions = true) => ({ question, chosen: 1, answer: 0, difficulty: null, ...(withOptions && { options: opts, explanation: 'Because.' }) });
const right = (question: string) => ({ question, chosen: 0, answer: 0, difficulty: null, options: opts });

describe('collectMistakes', () => {
  it('collects wrong answers, counts repeats, and marks later right answers as fixed', () => {
    const list = collectMistakes([
      attempt('2026-11-01T10:00:00Z', [wrong('Magma on the surface?'), wrong('Hottest lava?')]),
      attempt('2026-11-02T10:00:00Z', [wrong('magma on the SURFACE?'), right('Hottest lava?')]),
    ]);
    expect(list).toHaveLength(2);
    const magma = list.find((m) => m.key === 'magma on the surface')!;
    expect(magma.timesWrong).toBe(2);
    expect(magma.fixed).toBe(false);
    expect(list.find((m) => m.question === 'Hottest lava?')!.fixed).toBe(true);
    // Unfixed first
    expect(list[0].fixed).toBe(false);
  });

  it('keeps old mistakes without options but never retries them', () => {
    const mistakes = collectMistakes([attempt('2026-11-01T10:00:00Z', [wrong('Old question?', false), wrong('New question?')])]);
    expect(retryQuestions(mistakes).map((q) => q.question)).toEqual(['New question?']);
    expect(reviewStats(mistakes, {}).olderWithoutOptions).toBe(1);
  });

  it('retry quiz puts unfixed and most-missed first, and caps the count', () => {
    const many = Array.from({ length: 14 }, (_, i) => wrong(`Q${i}?`));
    const mistakes = collectMistakes([
      attempt('2026-11-01T10:00:00Z', many),
      attempt('2026-11-02T10:00:00Z', [wrong('Q3?'), right('Q0?')]),
    ]);
    const qs = retryQuestions(mistakes, 10);
    expect(qs).toHaveLength(10);
    expect(qs[0].question).toBe('Q3?');
    expect(qs.map((q) => q.question)).not.toContain('Q0?');
    expect(qs[0]).toMatchObject({ options: opts, answerIndex: 0, explanation: 'Because.' });
  });
});

describe('spaced repetition', () => {
  const now = new Date('2026-11-18T09:00:00').getTime();
  const mistakes = collectMistakes([attempt('2026-11-01T10:00:00Z', [wrong('A?'), wrong('B?')])]);

  it('new cards are due straight away', () => {
    expect(dueCards(mistakes, {}, now)).toHaveLength(2);
  });

  it('knowing a card moves it up a box and schedules it days ahead; missing it resets to box 1, due now', () => {
    let s = gradeCard({}, 'a', true, now);
    expect(s.a.box).toBe(1);
    expect(dueCards(mistakes, s, now).map((m) => m.key)).toEqual(['b']);
    const tomorrow = now + INTERVAL_DAYS[1] * 86400000;
    expect(dueCards(mistakes, s, tomorrow).map((m) => m.key)).toContain('a');

    s = gradeCard(s, 'a', false, tomorrow);
    expect(s.a).toEqual({ box: 1, due: tomorrow });
  });

  it('a card known five times in a row is learned and stops coming back', () => {
    let s = {};
    let t = now;
    for (let i = 0; i < LEARNED_BOX; i += 1) {
      s = gradeCard(s, 'a', true, t);
      t += 40 * 86400000;
    }
    expect(dueCards(mistakes, s, t).map((m) => m.key)).toEqual(['b']);
    expect(reviewStats(mistakes, s, t).learned).toBe(1);
  });
});
