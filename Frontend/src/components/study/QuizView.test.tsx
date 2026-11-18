import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuizView from './QuizView';

const quiz = {
  questions: [
    { question: 'What is magma called on the surface?', options: ['Lava', 'Ash', 'Steam', 'Ice'], answerIndex: 0, explanation: 'Magma that erupts is lava.', timestamp: '' },
    { question: 'Which gas do plants release?', options: ['Carbon dioxide', 'Oxygen', 'Helium', 'Neon'], answerIndex: 1, explanation: 'Oxygen.', timestamp: '', difficulty: 'easy' as const },
  ],
};

describe('QuizView', () => {
  it('shows the explanation, scores the run and reports answers with their options', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn().mockResolvedValue('browser');
    render(<QuizView quiz={quiz} videoTitle="Volcanoes" onComplete={onComplete} />);

    expect(screen.getByText('What is magma called on the surface?')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Lava/ }));
    expect(screen.getByText('Magma that erupts is lava.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));

    await user.click(await screen.findByRole('radio', { name: /Helium/ })); // wrong
    await user.click(screen.getByRole('button', { name: /See score/ }));

    expect(await screen.findByLabelText('Grade D')).toBeInTheDocument(); // 1 of 2 = 50%
    expect(onComplete).toHaveBeenCalledTimes(1);
    const { answers } = onComplete.mock.calls[0][0];
    expect(answers).toEqual([
      expect.objectContaining({ chosen: 0, answer: 0, options: quiz.questions[0].options, explanation: 'Magma that erupts is lava.' }),
      expect.objectContaining({ chosen: 2, answer: 1, difficulty: 'easy' }),
    ]);
  });

  it('locks an answer once chosen', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<QuizView quiz={quiz} videoTitle="Volcanoes" onComplete={onComplete} />);
    await user.click(screen.getByRole('radio', { name: /Ash/ }));
    expect(screen.getByRole('radio', { name: /Lava/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Ash/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.click(await screen.findByRole('radio', { name: /Oxygen/ }));
    await user.click(screen.getByRole('button', { name: /See score/ }));
    expect(onComplete.mock.calls[0][0].answers[0].chosen).toBe(1);
  });
});
