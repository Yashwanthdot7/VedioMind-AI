import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Trophy, Download, BarChart3 } from 'lucide-react';
import { Difficulty, QuizResult, StudyQuiz } from '../../types';
import { gradeClass, gradeFor } from '../../lib/grades';
import TimestampChip from './TimestampChip';
import { downloadText, slugify } from '../../lib/download';

type QuizQuestion = StudyQuiz['questions'][number] & { difficulty?: Difficulty | null };

interface QuizViewProps {
  quiz: { questions: QuizQuestion[] };
  videoTitle: string;
  onSeek?: (seconds: number) => void;
  /** Called once per completed run; resolve with where it was saved to show a note */
  onComplete?: (result: QuizResult) => Promise<'account' | 'browser' | null | void> | void;
  /** Opens the analytics page from the score screen */
  onOpenAnalytics?: () => void;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function toMarkdown(quiz: StudyQuiz, title: string) {
  const out = [`# Quiz: ${title}`, ''];
  quiz.questions.forEach((q, i) => {
    out.push(`**${i + 1}. ${q.question}**`, '');
    q.options.forEach((o, j) => out.push(`${LETTERS[j]}) ${o}`));
    out.push('');
  });
  out.push('---', '', '## Answer key', '');
  quiz.questions.forEach((q, i) => {
    out.push(`${i + 1}. **${LETTERS[q.answerIndex]}** — ${q.explanation}${q.timestamp ? ` (${q.timestamp})` : ''}`);
  });
  return out.join('\n');
}

export default function QuizView({ quiz, videoTitle, onSeek, onComplete, onOpenAnalytics }: QuizViewProps) {
  const total = quiz.questions.length;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.questions.map(() => null));
  const finished = index >= total;

  const current = quiz.questions[index];
  const chosen = finished ? null : answers[index];
  const score = answers.reduce<number>((n, a, i) => (a === quiz.questions[i].answerIndex ? n + 1 : n), 0);

  const choose = (optionIndex: number) => {
    if (chosen !== null) return;
    setAnswers((prev) => prev.map((a, i) => (i === index ? optionIndex : a)));
  };

  // Report each finished run once (for analytics)
  const startedAt = useRef(Date.now());
  const reported = useRef(false);
  const [savedTo, setSavedTo] = useState<'account' | 'browser' | null>(null);
  useEffect(() => {
    if (!finished || reported.current || !onComplete) return;
    reported.current = true;
    const result: QuizResult = {
      durationSec: (Date.now() - startedAt.current) / 1000,
      answers: quiz.questions.map((q, i) => ({
        question: q.question,
        chosen: answers[i] ?? -1,
        answer: q.answerIndex,
        difficulty: q.difficulty ?? null,
        options: q.options,
        explanation: q.explanation,
      })).filter((a) => a.chosen >= 0),
    };
    if (!result.answers.length) return;
    Promise.resolve(onComplete(result)).then((where) => setSavedTo(where || null)).catch(() => {});
  }, [finished, onComplete, quiz.questions, answers]);

  const restart = () => {
    setAnswers(quiz.questions.map(() => null));
    setIndex(0);
    startedAt.current = Date.now();
    reported.current = false;
    setSavedTo(null);
  };

  const downloadButton = (
    <button
      onClick={() => downloadText(`${slugify(videoTitle)}-quiz.md`, toMarkdown(quiz, videoTitle), 'text/markdown')}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-ink-800/50 hover:bg-ink-700/50 text-ink-400 hover:text-ink-200"
      title="Download quiz with answer key (.md) — handy for teachers"
    >
      <Download className="w-3.5 h-3.5" /> Printable quiz
    </button>
  );

  if (finished) {
    const pct = Math.round((score / total) * 100);
    const message = pct === 100 ? 'Perfect score! 🎉' : pct >= 70 ? 'Great job!' : pct >= 40 ? 'Good effort — review the ones you missed.' : 'Keep going — rewatch the parts below and try again.';
    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        <div className="text-center p-6 rounded-2xl border border-turmeric-500/20 bg-turmeric-400 text-ink-950">
          <Trophy className="w-10 h-10 mx-auto text-amber-400 mb-2" />
          <div className="flex items-center justify-center gap-3">
            <p className="text-3xl font-bold text-ink-100">{score} / {total}</p>
            <span className={`px-2.5 py-1 rounded-lg border text-sm font-bold ${gradeClass(gradeFor(pct))}`} aria-label={`Grade ${gradeFor(pct)}`}>
              {gradeFor(pct)}
            </span>
          </div>
          <p className="text-sm text-ink-400 mt-1">{pct}% · {message}</p>
          {savedTo && (
            <p className="text-xs text-ink-500 mt-2">
              Saved to your analytics{savedTo === 'browser' ? ' on this browser' : ''}.
              {onOpenAnalytics && (
                <button onClick={onOpenAnalytics} className="ml-1 inline-flex items-center gap-1 text-turmeric-300 hover:underline">
                  <BarChart3 className="w-3 h-3" /> View progress
                </button>
              )}
            </p>
          )}
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={restart} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-turmeric-400 hover:bg-turmeric-300 text-ink-950">
              <RotateCcw className="w-4 h-4" /> Try again
            </button>
            {downloadButton}
          </div>
        </div>
        <ul className="space-y-2">
          {quiz.questions.map((q, i) => {
            const correct = answers[i] === q.answerIndex;
            return (
              <li key={i} className="flex items-start gap-2 p-3 rounded-lg bg-ink-950/40 border border-ink-800/60 text-sm">
                {correct ? <CheckCircle2 className="w-4 h-4 text-lagoon-400 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-ink-200">{q.question}</p>
                  {!correct && <p className="text-xs text-lagoon-300/80 mt-1">Answer: {q.options[q.answerIndex]}</p>}
                </div>
                <TimestampChip timestamp={q.timestamp} onSeek={onSeek} />
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-500">Question {index + 1} of {total}</span>
        {downloadButton}
      </div>
      <div className="h-1.5 bg-ink-800 rounded-full overflow-hidden">
        <div className="h-full transition-all bg-turmeric-400 text-ink-950" style={{ width: `${(index / total) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          <p className="text-base font-medium text-ink-100 leading-snug">{current.question}</p>
          <div className="space-y-2" role="radiogroup">
            {current.options.map((option, i) => {
              const isAnswer = i === current.answerIndex;
              const isChosen = i === chosen;
              let style = 'border-ink-700/60 bg-ink-950/40 hover:border-turmeric-500/50 hover:bg-turmeric-500/5 text-ink-200';
              if (chosen !== null) {
                if (isAnswer) style = 'border-lagoon-500/60 bg-lagoon-500/10 text-lagoon-100';
                else if (isChosen) style = 'border-red-500/60 bg-red-500/10 text-red-100';
                else style = 'border-ink-800/60 bg-ink-950/20 text-ink-500';
              }
              return (
                <button
                  key={i}
                  role="radio"
                  aria-checked={isChosen}
                  disabled={chosen !== null}
                  onClick={() => choose(i)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left text-sm transition-colors ${style}`}
                >
                  <span className="w-6 h-6 rounded-md bg-ink-800/80 flex items-center justify-center text-xs font-semibold shrink-0">{LETTERS[i]}</span>
                  <span className="flex-1 leading-relaxed">{option}</span>
                  {chosen !== null && isAnswer && <CheckCircle2 className="w-5 h-5 text-lagoon-400 shrink-0" />}
                  {chosen !== null && isChosen && !isAnswer && <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {chosen !== null && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-ink-800/40 border border-ink-700/50 space-y-2">
              <p className={`text-sm font-semibold ${chosen === current.answerIndex ? 'text-lagoon-300' : 'text-red-300'}`}>
                {chosen === current.answerIndex ? 'Correct!' : 'Not quite.'}
              </p>
              {current.explanation && <p className="text-sm text-ink-300 leading-relaxed">{current.explanation}</p>}
              <div className="flex items-center justify-between gap-2">
                <TimestampChip timestamp={current.timestamp} onSeek={onSeek} label="Watch" />
                <button
                  onClick={() => setIndex((i) => i + 1)}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-turmeric-400 hover:bg-turmeric-300 text-ink-950"
                  autoFocus
                >
                  {index + 1 === total ? 'See score' : 'Next'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
