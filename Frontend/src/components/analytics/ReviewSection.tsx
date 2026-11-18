import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Layers, ArrowLeft, Check, X, PartyPopper } from 'lucide-react';
import { QuizAttempt } from '../../types';
import { recordAttempt } from '../../lib/attempts';
import {
  collectMistakes, dueCards, gradeCard, loadSchedule, retryQuestions, reviewStats, saveSchedule, cardState, INTERVAL_DAYS, LEARNED_BOX, Mistake, Schedule,
} from '../../lib/review';
import QuizView from '../study/QuizView';

type Mode = 'summary' | 'retry' | 'cards';

interface ReviewSectionProps {
  attempts: QuizAttempt[];
  /** Whose schedule this is: the user id, or "guest" */
  scope: string;
  onAttemptSaved: () => void;
}

function Cards({ cards, schedule, onGrade, onDone }: {
  cards: Mistake[]; schedule: Schedule; onGrade: (key: string, knew: boolean) => void; onDone: () => void;
}) {
  const [queue] = useState(cards); // fixed for this session, so grading doesn't reshuffle it
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knewCount, setKnewCount] = useState(0);
  const card = queue[i];

  const grade = (knew: boolean) => {
    onGrade(card.key, knew);
    if (knew) setKnewCount((n) => n + 1);
    setFlipped(false);
    setI((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(true); }
      if (flipped && e.key === '1') grade(false);
      if (flipped && e.key === '2') grade(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!card) {
    return (
      <div className="py-12 text-center space-y-3">
        <PartyPopper className="w-9 h-9 mx-auto text-turmeric-400" />
        <p className="text-lg font-semibold text-ink-100">Review done</p>
        <p className="text-sm text-ink-400">
          You knew {knewCount} of {queue.length}. Cards you knew come back in a few days; the ones you missed come back today.
        </p>
        <button onClick={onDone} className="px-4 py-2 rounded-lg border border-ink-600 text-ink-100 hover:border-turmeric-400/60">Back to progress</button>
      </div>
    );
  }

  const box = cardState(schedule, card.key).box;
  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-sm text-ink-500 mb-3">Card {i + 1} of {queue.length}</p>
      <div className="rounded-panel border border-ink-700 bg-ink-950/60 p-6 min-h-[16rem] flex flex-col">
        <p className="text-xs text-ink-500">From “{card.source}”{card.timesWrong > 1 ? `, missed ${card.timesWrong} times` : ''}</p>
        <p className="mt-3 text-lg text-ink-50 leading-relaxed">{card.question}</p>
        {flipped ? (
          <div className="mt-5 pt-5 border-t border-ink-800 space-y-2">
            <p className="text-lagoon-300 font-medium">{card.options?.[card.answer]}</p>
            {card.explanation && <p className="text-sm text-ink-300 leading-relaxed">{card.explanation}</p>}
          </div>
        ) : (
          <button onClick={() => setFlipped(true)} className="mt-auto self-start px-4 py-2 rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-100 text-sm">
            Show answer <span className="text-ink-500">(Space)</span>
          </button>
        )}
      </div>
      {flipped && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => grade(false)} className="flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10">
            <X className="w-4 h-4" /> Didn't know <span className="text-xs text-ink-500">(1)</span>
          </button>
          <button onClick={() => grade(true)} className="flex items-center justify-center gap-2 py-3 rounded-xl border border-lagoon-500/50 text-lagoon-300 hover:bg-lagoon-500/10">
            <Check className="w-4 h-4" /> Knew it <span className="text-xs text-ink-500">(2)</span>
          </button>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-500">
        {box === 0 ? 'New card.' : `Box ${box} of ${LEARNED_BOX}.`} Knowing it moves it to box {Math.min(box + 1, LEARNED_BOX)} and brings it back in {INTERVAL_DAYS[Math.min(box + 1, LEARNED_BOX)]} day(s).
      </p>
    </div>
  );
}

export default function ReviewSection({ attempts, scope, onAttemptSaved }: ReviewSectionProps) {
  const [mode, setMode] = useState<Mode>('summary');
  const [schedule, setSchedule] = useState<Schedule>(() => loadSchedule(scope));
  const [runKey, setRunKey] = useState(0);
  // Picked when a session starts, so saving the result (which reloads the history) can't change them mid-quiz
  const [session, setSession] = useState<{ questions: ReturnType<typeof retryQuestions>; cards: Mistake[] }>({ questions: [], cards: [] });

  useEffect(() => { setSchedule(loadSchedule(scope)); }, [scope]);

  const mistakes = useMemo(() => collectMistakes(attempts), [attempts]);
  const stats = useMemo(() => reviewStats(mistakes, schedule), [mistakes, schedule]);
  if (mistakes.length === 0 && mode === 'summary') return null;

  const grade = (key: string, knew: boolean) => {
    setSchedule((prev) => {
      const next = gradeCard(prev, key, knew);
      saveSchedule(scope, next);
      return next;
    });
  };

  const start = (m: Mode) => {
    setSession({ questions: retryQuestions(mistakes), cards: dueCards(mistakes, schedule) });
    setRunKey((k) => k + 1);
    setMode(m);
  };

  return (
    <section className="p-5 rounded-2xl bg-ink-900/50 border border-turmeric-500/25" aria-labelledby="review-title">
      {mode !== 'summary' && (
        <button onClick={() => setMode('summary')} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-200 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      )}

      {mode === 'summary' && (
        <div className="flex flex-wrap items-center gap-5">
          <div className="mr-auto">
            <h2 id="review-title" className="text-base font-semibold text-ink-100">Review your mistakes</h2>
            <p className="text-sm text-ink-400 mt-1">
              {stats.total} question{stats.total === 1 ? '' : 's'} answered wrong{stats.open < stats.total ? `, ${stats.total - stats.open} since answered right` : ''}.
              {' '}{stats.due > 0 ? `${stats.due} card${stats.due === 1 ? '' : 's'} due today.` : 'No cards due today.'}
              {stats.learned > 0 ? ` ${stats.learned} learned.` : ''}
            </p>
            {stats.olderWithoutOptions > 0 && (
              <p className="text-xs text-ink-500 mt-1">
                {stats.olderWithoutOptions} older mistake{stats.olderWithoutOptions === 1 ? '' : 's'} can't be retried because those quizzes didn't save their answer options.
              </p>
            )}
          </div>
          <button
            onClick={() => start('retry')}
            disabled={stats.retryable === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-turmeric-400 hover:bg-turmeric-300 text-ink-950 font-semibold disabled:bg-ink-800 disabled:text-ink-500"
          >
            <RotateCcw className="w-4 h-4" /> Retry {Math.min(stats.retryable, 10)} question{Math.min(stats.retryable, 10) === 1 ? '' : 's'}
          </button>
          <button
            onClick={() => start('cards')}
            disabled={stats.due === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-ink-600 text-ink-100 hover:border-turmeric-400/60 disabled:opacity-40"
          >
            <Layers className="w-4 h-4" /> Review cards{stats.due ? ` (${stats.due})` : ''}
          </button>
        </div>
      )}

      {mode === 'retry' && (
        <QuizView
          key={runKey}
          quiz={{ questions: session.questions }}
          videoTitle="Review: your mistakes"
          onComplete={async (result) => {
            const saved = await recordAttempt({
              source: 'study', kind: 'quiz', title: 'Review: your mistakes', language: attempts[0]?.language || 'en',
              answers: result.answers, durationSec: result.durationSec,
            });
            onAttemptSaved();
            return saved.where;
          }}
        />
      )}

      {mode === 'cards' && (
        <Cards key={runKey} cards={session.cards} schedule={schedule} onGrade={grade} onDone={() => setMode('summary')} />
      )}
    </section>
  );
}
