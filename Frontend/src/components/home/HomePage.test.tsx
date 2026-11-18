import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from './HomePage';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null, enabled: false, loading: false }) }));
vi.mock('../../services/apiService', () => ({ getLibrary: vi.fn().mockResolvedValue([]) }));

const props = () => ({
  busy: false, language: 'en', onLanguageChange: vi.fn(), onSummarize: vi.fn(), onMakeLesson: vi.fn(), onOpenLibraryItem: vi.fn(), onPlayLesson: vi.fn(),
});

describe('HomePage', () => {
  it('has one accessible headline for screen readers', () => {
    render(<HomePage {...props()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Learn anything, in your language.');
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

  it('the showcase carousel moves with its arrows and thumbnails, and topics in a world start a lesson', async () => {
    const user = userEvent.setup();
    const p = props();
    render(<HomePage {...p} />);
    await user.click(screen.getByRole('button', { name: 'Next lesson' }));
    expect(screen.getByRole('button', { name: 'Play lesson: The water cycle' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous lesson' }));
    await user.click(screen.getByRole('button', { name: 'Previous lesson' }));
    expect(screen.getByRole('button', { name: 'Make lesson: How volcanoes work' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show How computers store numbers' }));
    await user.click(screen.getByRole('button', { name: 'Play lesson: How computers store numbers' }));
    expect(p.onPlayLesson).toHaveBeenLastCalledWith('How computers store numbers');

    await user.click(screen.getByRole('button', { name: "Pythagoras' theorem" }));
    expect(p.onMakeLesson).toHaveBeenLastCalledWith("Pythagoras' theorem");
  });

  it('shows the settled headline straight away when reduced motion is on', () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...original(q), matches: q.includes('reduce') })) as typeof window.matchMedia;
    try {
      const { container } = render(<HomePage {...props()} />);
      expect(container.querySelector('[lang="bn"]')).not.toBeNull();
      expect(container.querySelector('[lang="hi"]')).toBeNull();
    } finally {
      window.matchMedia = original;
    }
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
