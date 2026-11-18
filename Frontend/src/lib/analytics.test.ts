import { describe, expect, it } from 'vitest';
import { QuizAttempt } from '../types';
import { currentStreak, filterAttempts, summarise } from './analytics';
import { gradeFor } from './grades';
import { formatDuration, parseTimestamp } from './time';

const a = (daysAgo: number, scorePct: number, source: 'study' | 'lesson' = 'study', title = `T${daysAgo}`): QuizAttempt => ({
  id: String(Math.random()), source, kind: 'quiz', title, language: 'en', durationSec: 120,
  answers: [{ question: 'q', chosen: 0, answer: scorePct >= 50 ? 0 : 1, difficulty: 'easy' }],
  total: 1, correct: scorePct >= 50 ? 1 : 0, scorePct, grade: gradeFor(scorePct),
  createdAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
});

describe('analytics', () => {
  it('grades by score bands', () => {
    expect([95, 85, 75, 65, 10].map(gradeFor)).toEqual(['A+', 'A', 'B', 'C', 'D']);
  });
  it('filters by range and source', () => {
    const list = [a(1, 80), a(10, 90, 'lesson'), a(40, 50)];
    expect(filterAttempts(list, '7d', 'all')).toHaveLength(1);
    expect(filterAttempts(list, '30d', 'lesson')).toHaveLength(1);
    expect(filterAttempts(list, 'all', 'study')).toHaveLength(2);
  });
  it('counts a streak ending today or yesterday', () => {
    expect(currentStreak([a(0, 50), a(1, 50), a(2, 50), a(4, 50)])).toBe(3);
    expect(currentStreak([a(1, 50), a(2, 50)])).toBe(2);
    expect(currentStreak([a(3, 50)])).toBe(0);
  });
  it('summarises averages, best, time and what to review', () => {
    const s = summarise([a(0, 100), a(1, 40, 'study', 'Weak topic'), a(2, 60)]);
    expect(s.averagePct).toBe(67);
    expect(s.best?.scorePct).toBe(100);
    expect(s.minutes).toBe(6);
    expect(s.toReview.map((x) => x.title)).toEqual(['Weak topic', 'T2']);
    expect(s.byDifficulty[0]).toMatchObject({ difficulty: 'easy', total: 3 });
  });
});

describe('timestamps', () => {
  it('parses and formats', () => {
    expect(parseTimestamp('4:32')).toBe(272);
    expect(parseTimestamp('1:02:05')).toBe(3725);
    expect(parseTimestamp('4:72')).toBeNull();
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(5)).toBe('0:05');
  });
});
