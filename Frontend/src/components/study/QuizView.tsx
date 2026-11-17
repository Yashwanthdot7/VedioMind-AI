import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Trophy, Download } from 'lucide-react';
import { StudyQuiz } from '../../types';
import TimestampChip from './TimestampChip';
import { downloadText, slugify } from '../../lib/download';

interface QuizViewProps {
  quiz: StudyQuiz;
  videoTitle: string;
  onSeek?: (seconds: number) => void;
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

export default function QuizView({ quiz, videoTitle, onSeek }: QuizViewProps) {
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

  const restart = () => {
    setAnswers(quiz.questions.map(() => null));
    setIndex(0);
  };

  const downloadButton = (
    <button
      onClick={() => downloadText(`${slugify(videoTitle)}-quiz.md`, toMarkdown(quiz, videoTitle), 'text/markdown')}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-slate-200"
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
        <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
          <Trophy className="w-10 h-10 mx-auto text-amber-400 mb-2" />
          <p className="text-3xl font-bold text-slate-100">{score} / {total}</p>
          <p className="text-sm text-slate-400 mt-1">{message}</p>
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={restart} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">
              <RotateCcw className="w-4 h-4" /> Try again
            </button>
            {downloadButton}
          </div>
        </div>
        <ul className="space-y-2">
          {quiz.questions.map((q, i) => {
            const correct = answers[i] === q.answerIndex;
            return (
              <li key={i} className="flex items-start gap-2 p-3 rounded-lg bg-slate-950/40 border border-slate-800/60 text-sm">
                {correct ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200">{q.question}</p>
                  {!correct && <p className="text-xs text-emerald-300/80 mt-1">Answer: {q.options[q.answerIndex]}</p>}
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
        <span className="text-xs text-slate-500">Question {index + 1} of {total}</span>
        {downloadButton}
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${(index / total) * 100}%` }} />
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
          <p className="text-base font-medium text-slate-100 leading-snug">{current.question}</p>
          <div className="space-y-2" role="radiogroup">
            {current.options.map((option, i) => {
              const isAnswer = i === current.answerIndex;
              const isChosen = i === chosen;
              let style = 'border-slate-700/60 bg-slate-950/40 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-slate-200';
              if (chosen !== null) {
                if (isAnswer) style = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-100';
                else if (isChosen) style = 'border-red-500/60 bg-red-500/10 text-red-100';
                else style = 'border-slate-800/60 bg-slate-950/20 text-slate-500';
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
                  <span className="w-6 h-6 rounded-md bg-slate-800/80 flex items-center justify-center text-xs font-semibold shrink-0">{LETTERS[i]}</span>
                  <span className="flex-1 leading-relaxed">{option}</span>
                  {chosen !== null && isAnswer && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                  {chosen !== null && isChosen && !isAnswer && <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {chosen !== null && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-2">
              <p className={`text-sm font-semibold ${chosen === current.answerIndex ? 'text-emerald-300' : 'text-red-300'}`}>
                {chosen === current.answerIndex ? 'Correct!' : 'Not quite.'}
              </p>
              {current.explanation && <p className="text-sm text-slate-300 leading-relaxed">{current.explanation}</p>}
              <div className="flex items-center justify-between gap-2">
                <TimestampChip timestamp={current.timestamp} onSeek={onSeek} label="Watch" />
                <button
                  onClick={() => setIndex((i) => i + 1)}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
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
