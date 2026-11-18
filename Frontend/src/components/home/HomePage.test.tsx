import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from './HomePage';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null, enabled: false, loading: false }) }));
vi.mock('../../services/apiService', () => ({ getLibrary: vi.fn().mockResolvedValue([]) }));

const props = () => ({
  busy: false, language: 'en', onLanguageChange: vi.fn(), onSummarize: vi.fn(), onMakeLesson: vi.fn(), onOpenLibraryItem: vi.fn(),
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
    await user.click(screen.getByRole('tab', { name: /video lesson/i }));
    await user.type(screen.getByLabelText('Lesson topic'), 'The water cycle');
    await user.click(screen.getByRole('button', { name: 'Plan the lesson' }));
    expect(p.onMakeLesson).toHaveBeenCalledWith('The water cycle');

    await user.click(screen.getByRole('button', { name: /Photosynthesis/ }));
    expect(p.onMakeLesson).toHaveBeenLastCalledWith('Photosynthesis');
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
