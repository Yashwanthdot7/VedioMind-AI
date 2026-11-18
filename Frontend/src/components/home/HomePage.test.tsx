import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from './HomePage';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null, enabled: false, loading: false }) }));
vi.mock('../../services/apiService', () => ({ getLibrary: vi.fn().mockResolvedValue([]) }));
vi.mock('../../context/LearnerContext', () => ({ useLearner: () => ({ learner: { role: 'student', level: 'beginner' }, openSettings: vi.fn() }) }));
const attempts = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock('../../lib/attempts', () => ({ listAttempts: () => Promise.resolve({ attempts: attempts.list, where: 'browser' }) }));

const props = () => ({
  busy: false, language: 'en', onLanguageChange: vi.fn(), onSummarize: vi.fn(), onMakeLesson: vi.fn(), onOpenLibraryItem: vi.fn(), onPlayLesson: vi.fn(),
});

describe('HomePage', () => {
  it('has one accessible headline for screen readers', () => {
    render(<HomePage {...props()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Understand any video. Learn any topic.');
  });

  it('summarizes a pasted link', async () => {
    const user = userEvent.setup();
    const p = props();
    render(<HomePage {...p} />);
    const button = screen.getByRole('button', { name: 'Summarize' });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('YouTube link'), 'https://youtu.be/abcdefghijk');
    await user.click(button);
    expect(p.onSummarize).toHaveBeenCalledWith('https://youtu.be/abcdefghijk');
  });

  it('switches to lesson mode and passes the topic on, or starts from an example', async () => {
    const user = userEvent.setup();
    const p = props();
    render(<HomePage {...p} />);
    await user.click(screen.getByRole('tab', { name: /make a lesson/i }));
    await user.type(screen.getByLabelText('Lesson topic'), 'The water cycle');
    await user.click(screen.getByRole('button', { name: 'Plan the lesson' }));
    expect(p.onMakeLesson).toHaveBeenCalledWith('The water cycle');

    // Ready-made samples play at once
    await user.click(screen.getByRole('button', { name: 'Play lesson: Photosynthesis' }));
    expect(p.onPlayLesson).toHaveBeenLastCalledWith('Photosynthesis');
    await user.click(screen.getByRole('button', { name: /Watch a 1-minute sample lesson/ }));
    expect(p.onPlayLesson).toHaveBeenCalledTimes(2);
  });

  it('subject topics open the lesson form', async () => {
    const user = userEvent.setup();
    const p = props();
    render(<HomePage {...p} />);
    await user.click(screen.getByRole('button', { name: "Pythagoras' theorem" }));
    expect(p.onMakeLesson).toHaveBeenLastCalledWith("Pythagoras' theorem");
  });

  it('new learners see how it works; returning learners see their streak and mistakes to review', async () => {
    attempts.list = [];
    const { unmount } = render(<HomePage {...props()} />);
    expect(await screen.findByRole('heading', { name: 'How it works' })).toBeInTheDocument();
    unmount();

    attempts.list = [{
      id: 'a1', source: 'lesson', kind: 'quick', title: 'Volcanoes', language: 'en', createdAt: new Date().toISOString(),
      scorePct: 50, grade: 'C', total: 2, correct: 1, durationSec: 30,
      answers: [
        { question: 'What is lava?', options: ['Magma on the surface', 'Ice'], answer: 0, chosen: 1, difficulty: 'easy' },
        { question: 'Where is magma?', options: ['Underground', 'Sky'], answer: 0, chosen: 0, difficulty: 'easy' },
      ],
    }];
    const p = { ...props(), onOpenProgress: vi.fn() };
    render(<HomePage {...p} />);
    expect(await screen.findByRole('heading', { name: 'Keep going' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Review 1 mistake' }));
    expect(p.onOpenProgress).toHaveBeenCalled();
    attempts.list = [];
  });
});

describe('sample lessons', () => {
  it('ship with full scripts and a 5-question quiz, and need nothing from the server', async () => {
    const { SAMPLE_LESSONS, sampleFor } = await import('../../data/sampleLessons');
    const all = Object.values(SAMPLE_LESSONS);
    expect(all).toHaveLength(3);
    for (const l of all) {
      expect(l.sample).toBe(true);
      expect(l.voiceMode).toBe('browser');
      expect(l.visuals).toBe('slides');
      expect(l.scenes.length).toBeGreaterThanOrEqual(5);
      expect(l.scenes[0].layout).toBe('title');
      expect(l.scenes[l.scenes.length - 1].layout).toBe('summary');
      expect(l.scenes.every((s) => !s.image && s.narration.split(' ').length >= 15)).toBe(true);
      expect(l.quiz).toHaveLength(5);
      expect(l.quiz.every((q) => q.options[q.answerIndex] !== undefined)).toBe(true);
    }
    expect(sampleFor('Photosynthesis')?.id).toBe('sample-photosynthesis');
    expect(sampleFor('How volcanoes work')).toBeNull();
  });
});
