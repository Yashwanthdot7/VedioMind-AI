import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Languages, PlayCircle, Play, Youtube, PenLine, Flame, Target, RotateCcw, ArrowRight,
  Link2, BookOpenText, ListChecks, GraduationCap, Presentation, Clock,
} from 'lucide-react';
import { LANGUAGES } from '../../constants/languages';
import { useAuth } from '../../context/AuthContext';
import { useLearner } from '../../context/LearnerContext';
import { getLibrary } from '../../services/apiService';
import { LibraryItem } from '../../types';
import { listAttempts } from '../../lib/attempts';
import { currentStreak } from '../../lib/analytics';
import { collectMistakes } from '../../lib/review';
import { learnerLabel } from '../learner/LearnerChoice';
import { SAMPLES, SUBJECTS } from './topics';

type Mode = 'video' | 'lesson';

interface HomePageProps {
  busy: boolean;
  language: string;
  onLanguageChange: (code: string) => void;
  onSummarize: (url: string) => void;
  onMakeLesson: (topic: string) => void;
  onOpenLibraryItem: (item: LibraryItem) => void;
  onOpenLessons?: () => void;
  /** Ready-made lessons play at once; other topics open the lesson form */
  onPlayLesson?: (topic: string) => void;
  /** The progress page, where mistakes are reviewed */
  onOpenProgress?: () => void;
}

interface Stats { quizzes: number; streak: number; toReview: number; weekQuizzes: number }

/** Progress from quizzes taken here (account or browser), used to encourage the next step */
function useStats(): Stats | null {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let cancelled = false;
    listAttempts()
      .then(({ attempts }) => {
        if (cancelled) return;
        const weekAgo = Date.now() - 7 * 86_400_000;
        setStats({
          quizzes: attempts.length,
          streak: currentStreak(attempts),
          toReview: collectMistakes(attempts).filter((m) => !m.fixed).length,
          weekQuizzes: attempts.filter((a) => Date.parse(a.createdAt) >= weekAgo).length,
        });
      })
      .catch(() => { if (!cancelled) setStats(null); });
    return () => { cancelled = true; };
  }, [user]);
  return stats;
}

/** An example of what one video turns into: shows the product instead of describing it */
function ExampleCard() {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-ink-900 p-5 shadow-[0_30px_80px_-40px_rgba(138,79,214,0.6)]" aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-16 items-center justify-center rounded-md bg-ink-800"><Play className="h-4 w-4 fill-ink-300 text-ink-300" /></div>
        <div>
          <p className="text-sm font-semibold text-ink-50">How photosynthesis works</p>
          <p className="text-xs text-ink-500">12 min video → 1 page</p>
        </div>
      </div>
      <p className="mt-5 text-xs font-semibold text-neon-300">Summary</p>
      <ul className="mt-2 space-y-2 text-sm text-ink-200">
        <li className="flex gap-2"><span className="rounded bg-plasma-400/10 px-1.5 text-xs leading-5 text-plasma-300">1:40</span> Chlorophyll captures light energy</li>
        <li className="flex gap-2"><span className="rounded bg-plasma-400/10 px-1.5 text-xs leading-5 text-plasma-300">4:05</span> Water and CO₂ become glucose</li>
        <li className="flex gap-2"><span className="rounded bg-plasma-400/10 px-1.5 text-xs leading-5 text-plasma-300">8:30</span> Oxygen is released as a by-product</li>
      </ul>
      <div className="mt-5 rounded-xl bg-ink-950/70 p-4">
        <p className="text-xs font-semibold text-neon-300">Check yourself · 3 of 5</p>
        <p className="mt-1.5 text-sm text-ink-100">What does chlorophyll absorb?</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <span className="rounded-lg border border-plasma-400/60 bg-plasma-400/10 px-3 py-2 text-ink-50">Red and blue light ✓</span>
          <span className="rounded-lg border border-white/10 px-3 py-2 text-ink-400">Only green light</span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-800"><div className="h-full w-3/5 rounded-full bg-plasma-400" /></div>
      </div>
    </div>
  );
}

const STEPS = [
  { icon: Link2, title: 'Paste a link or a topic', text: 'Any YouTube video, a topic, your notes, or a PDF chapter.' },
  { icon: BookOpenText, title: 'Learn it your way', text: 'A summary, notes and a tutor at your level, or a short narrated lesson.' },
  { icon: ListChecks, title: 'Check what stuck', text: 'Quick quizzes and flashcards. Anything you miss comes back for review.' },
];

export default function HomePage({ busy, language, onLanguageChange, onSummarize, onMakeLesson, onOpenLibraryItem, onOpenLessons, onPlayLesson, onOpenProgress }: HomePageProps) {
  const play = onPlayLesson || onMakeLesson;
  const { user } = useAuth();
  const { learner, openSettings } = useLearner();
  const stats = useStats();
  const [mode, setMode] = useState<Mode>('video');
  const [value, setValue] = useState('');
  const [recent, setRecent] = useState<LibraryItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) { setRecent([]); return; }
    getLibrary().then((items) => setRecent(items.slice(0, 4))).catch(() => {});
  }, [user]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    if (mode === 'video') onSummarize(v);
    else onMakeLesson(v);
  };

  const pickMode = (m: Mode) => {
    setMode(m);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const firstName = ((user?.user_metadata?.full_name as string) || '').split(' ')[0];
  const returning = !!stats && stats.quizzes > 0;

  return (
    <div>
      {/* ------------------------------------------------ hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(60%_80%_at_30%_0%,rgba(138,79,214,0.22),transparent_70%)]" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:pt-20">
          <div>
            <p className="text-sm font-medium text-plasma-400">
              {firstName ? `Welcome back, ${firstName}` : 'Free, in 15 languages'}
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.6rem]">
              Understand any video.{' '}<br />Learn any topic.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-300">
              Paste a YouTube link or type a topic. VideoMind explains it at your level, in your language, then checks what you learned.
            </p>

            <form onSubmit={submit} className="mt-8 max-w-2xl rounded-2xl border border-white/10 bg-ink-900 p-2">
              <div role="tablist" aria-label="What do you want to do?" className="flex gap-1 p-1">
                {([['video', 'Summarize a video', Youtube], ['lesson', 'Make a lesson', PenLine]] as const).map(([m, label, Icon]) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => pickMode(m)}
                    className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${mode === m ? 'bg-white/[0.08] text-white' : 'text-ink-400 hover:text-white'}`}
                  >
                    <Icon className={`h-4 w-4 ${mode === m ? 'text-plasma-400' : ''}`} /> {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2 p-1 sm:flex-row">
                <label className="flex-1">
                  <span className="sr-only">{mode === 'video' ? 'YouTube link' : 'Lesson topic'}</span>
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode={mode === 'video' ? 'url' : 'text'}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    disabled={busy}
                    placeholder={mode === 'video' ? 'Paste a YouTube link' : 'A topic, or paste your notes'}
                    className="w-full rounded-xl bg-ink-950 px-4 py-3.5 text-base text-white placeholder-ink-500 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-neon-400"
                  />
                </label>
                <label className="relative flex items-center" title="Output language">
                  <span className="sr-only">Output language</span>
                  <Languages className="pointer-events-none absolute left-3 h-4 w-4 text-ink-400" />
                  <select
                    value={language}
                    onChange={(e) => onLanguageChange(e.target.value)}
                    disabled={busy}
                    className="w-full appearance-none rounded-xl bg-ink-950 py-3.5 pl-9 pr-4 text-ink-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-neon-400 sm:w-auto"
                  >
                    {LANGUAGES.map((l) => <option key={l.code} value={l.code} className="bg-ink-900">{l.native}</option>)}
                  </select>
                </label>
                <button type="submit" disabled={busy || !value.trim()} className="btn-neon rounded-xl">
                  {mode === 'video' ? (busy ? 'Working…' : 'Summarize') : 'Plan the lesson'}
                </button>
              </div>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <button onClick={() => play('Photosynthesis')} className="flex items-center gap-2 font-semibold text-white hover:text-neon-200">
                <PlayCircle className="h-5 w-5 text-plasma-400" />
                Watch a 1-minute sample lesson
              </button>
              <button onClick={openSettings} className="text-ink-400 hover:text-white">
                Explained for: <span className="text-ink-100 underline decoration-neon-400/60 underline-offset-4">{learnerLabel(learner)}</span>
              </button>
            </div>
          </div>

          <div className="hidden lg:block"><ExampleCard /></div>
        </div>
      </section>

      {/* ------------------------------------------------ keep going (returning learners) */}
      {returning && stats && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-labelledby="progress-heading">
          <div className="rounded-2xl border border-white/10 bg-ink-900 p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="progress-heading" className="text-2xl font-bold text-white">Keep going</h2>
                <p className="mt-1 text-ink-400">
                  {stats.streak > 0 ? `You've studied ${stats.streak} day${stats.streak === 1 ? '' : 's'} in a row. One quiz today keeps it alive.` : 'Take one quiz today to start a streak.'}
                </p>
              </div>
              {stats.toReview > 0 && (
                <button onClick={onOpenProgress} className="btn-neon rounded-xl">
                  <RotateCcw className="h-4 w-4" /> Review {stats.toReview} mistake{stats.toReview === 1 ? '' : 's'}
                </button>
              )}
            </div>
            <dl className="mt-6 grid grid-cols-3 gap-3">
              {[
                { icon: Flame, label: 'Day streak', value: stats.streak },
                { icon: Target, label: 'Quizzes this week', value: stats.weekQuizzes },
                { icon: RotateCcw, label: 'To review', value: stats.toReview },
              ].map(({ icon: Icon, label, value: v }) => (
                <div key={label} className="rounded-xl bg-ink-950/70 p-4">
                  <dt className="flex items-center gap-2 text-sm text-ink-400"><Icon className="h-4 w-4 text-plasma-400" /> {label}</dt>
                  <dd className="mt-1 text-3xl font-bold text-white">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ recent videos */}
      {recent.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6" aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="text-2xl font-bold text-white">Pick up where you left off</h2>
          <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((item) => (
              <li key={item.analysisId}>
                <button onClick={() => onOpenLibraryItem(item)} className="block w-full overflow-hidden rounded-xl border border-white/10 bg-ink-900 text-left transition hover:border-neon-400/60">
                  <div className="aspect-video overflow-hidden bg-ink-800">
                    {item.thumbnail
                      ? <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
                      : <div className="flex h-full items-center justify-center"><PlayCircle className="h-8 w-8 text-ink-500" /></div>}
                  </div>
                  <p className="line-clamp-2 px-4 py-3 text-sm text-ink-100">{item.title}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------ how it works (new learners) */}
      {!returning && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-2xl font-bold text-white">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="rounded-2xl border border-white/10 bg-ink-900 p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neon-400/15 text-sm font-bold text-neon-200">{i + 1}</span>
                  <Icon className="h-5 w-5 text-plasma-400" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-1.5 leading-relaxed text-ink-400">{text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ------------------------------------------------ sample lessons */}
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6" aria-labelledby="samples-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="samples-heading" className="text-2xl font-bold text-white">Start with a 1-minute lesson</h2>
            <p className="mt-1 text-ink-400">Ready to watch now, with a short quiz at the end.</p>
          </div>
          {onOpenLessons && (
            <button onClick={onOpenLessons} className="flex items-center gap-1.5 text-sm font-semibold text-neon-200 hover:text-white">
              All video lessons <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {SAMPLES.map(({ topic, subject, blurb, icon: Icon }) => (
            <li key={topic} className="flex flex-col rounded-2xl border border-white/10 bg-ink-900 p-6 transition hover:border-neon-400/50">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-neon-400/15"><Icon className="h-5 w-5 text-neon-200" /></span>
                <span className="flex items-center gap-1 text-xs text-ink-500"><Clock className="h-3.5 w-3.5" /> about 1 min</span>
              </div>
              <p className="mt-4 text-xs font-medium text-plasma-400">{subject}</p>
              <h3 className="mt-1 text-lg font-semibold text-white">{topic}</h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-400">{blurb}</p>
              <button onClick={() => play(topic)} aria-label={`Play lesson: ${topic}`} className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-white/[0.06] py-2.5 text-sm font-semibold text-white transition hover:bg-neon-400">
                <Play className="h-4 w-4 fill-current" /> Play
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------ subjects */}
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6" aria-labelledby="subjects-heading">
        <h2 id="subjects-heading" className="text-2xl font-bold text-white">Make a lesson on anything</h2>
        <p className="mt-1 text-ink-400">Pick a topic to start, or type your own above. Making one takes about a minute.</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SUBJECTS.map(({ name, topics, icon: Icon }) => (
            <li key={name} className="rounded-2xl border border-white/10 bg-ink-900 p-5">
              <h3 className="flex items-center gap-2.5 font-semibold text-white"><Icon className="h-5 w-5 text-plasma-400" /> {name}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {topics.map((t) => (
                  <button
                    key={t}
                    onClick={() => onMakeLesson(t)}
                    className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-sm text-ink-200 transition hover:bg-neon-400/20 hover:text-white"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------ students and teachers */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="who-heading">
        <h2 id="who-heading" className="sr-only">For students and teachers</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-neon-400/15 to-ink-900 p-7">
            <GraduationCap className="h-7 w-7 text-neon-200" />
            <h3 className="mt-4 text-xl font-semibold text-white">For students</h3>
            <p className="mt-2 leading-relaxed text-ink-300">Pick beginner, intermediate or advanced. Summaries, tutor answers and lessons are explained at that level, and your mistakes come back until you've got them.</p>
            <button onClick={openSettings} className="mt-5 text-sm font-semibold text-neon-200 hover:text-white">Set my level →</button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-plasma-400/10 to-ink-900 p-7">
            <Presentation className="h-7 w-7 text-plasma-400" />
            <h3 className="mt-4 text-xl font-semibold text-white">For teachers</h3>
            <p className="mt-2 leading-relaxed text-ink-300">Make a teaching guide or a video for your class, get a printable lesson plan with it, and share a link students can open without an account.</p>
            <button onClick={onOpenLessons} className="mt-5 text-sm font-semibold text-plasma-300 hover:text-white">Make a class lesson →</button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-sm text-ink-500 sm:px-6">
          <span className="font-semibold text-ink-200">VideoMind</span>
          <span className="mr-auto">Free and open source. Summaries, study tools and video lessons in 15 languages.</span>
          <a href="https://github.com/Yashwanthdot7/VedioMind-AI" target="_blank" rel="noreferrer" className="hover:text-white">Source code</a>
        </div>
      </footer>
    </div>
  );
}
