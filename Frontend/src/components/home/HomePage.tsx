import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Languages, PlayCircle, ChevronRight, ChevronLeft, Play, Youtube, PenLine, Wand2 } from 'lucide-react';
import { LANGUAGES } from '../../constants/languages';
import { useAuth } from '../../context/AuthContext';
import { getLibrary } from '../../services/apiService';
import { LibraryItem } from '../../types';
import { useReveal } from '../../hooks/useReveal';
import PortalArt from '../art/PortalArt';
import WorldTile from '../art/WorldTile';
import { SHOWCASE, WORLDS } from './topics';
import { sampleFor } from '../../data/sampleLessons';

/** "Learn anything," in six Indian scripts; the line settles on the last one */
const SCRIPTS = [
  { text: 'कुछ भी सीखिए,', lang: 'hi' },
  { text: 'ಏನನ್ನಾದರೂ ಕಲಿಯಿರಿ,', lang: 'kn' },
  { text: 'எதையும் கற்றுக்கொள்ளுங்கள்,', lang: 'ta' },
  { text: 'ఏదైనా నేర్చుకోండి,', lang: 'te' },
  { text: 'എന്തും പഠിക്കൂ,', lang: 'ml' },
  { text: 'যেকোনো কিছু শিখুন,', lang: 'bn' },
];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

function CyclingLine() {
  const [i, setI] = useState(() => (prefersReducedMotion() ? SCRIPTS.length - 1 : 0));
  useEffect(() => {
    if (i >= SCRIPTS.length - 1) return;
    const id = window.setTimeout(() => setI((n) => n + 1), 900);
    return () => window.clearTimeout(id);
  }, [i]);
  const s = SCRIPTS[i];
  return (
    <span className={`block py-[0.08em] text-[0.62em] leading-[1.15] ${i < SCRIPTS.length - 1 ? 'min-h-[2.4em] sm:min-h-[1.2em]' : ''}`} aria-hidden="true">
      <span key={s.lang} lang={s.lang} className="inline-block animate-script-in normal-case text-plasma-gradient">{s.text}</span>
    </span>
  );
}

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
}

// ---------------------------------------------------------------- showcase carousel

function Showcase({ onLaunch, onSeeAll }: { onLaunch: (topic: string) => void; onSeeAll?: () => void }) {
  // Lessons that are ready to watch come first
  const [index, setIndex] = useState(0);
  const n = SHOWCASE.length;
  const go = (d: number) => setIndex((i) => (i + d + n) % n);
  const current = SHOWCASE[index];
  const next = SHOWCASE[(index + 1) % n];
  const { ref, shown } = useReveal<HTMLElement>(0.15);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  };

  return (
    <section
      ref={ref}
      aria-roledescription="carousel"
      aria-label="Lessons to start with"
      onKeyDown={onKey}
      className={`relative mx-auto max-w-[1400px] px-4 transition duration-700 sm:px-8 ${shown ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}
    >
      <div className="relative h-[560px] [perspective:1600px] sm:h-[600px]">
        {/* the next slide peeks in from the right */}
        <div className="absolute right-[-6%] top-[8%] hidden h-[84%] w-[30%] overflow-hidden rounded-[28px] opacity-60 md:block" style={{ transform: 'rotateY(-24deg) rotateZ(2deg)' }} aria-hidden="true">
          <WorldTile key={next.topic} theme={next.theme} className="h-full w-full" />
        </div>

        <div
          key={current.topic}
          className="absolute inset-y-0 left-0 right-0 animate-script-in overflow-hidden rounded-[28px] border border-white/10 md:right-[18%]"
          style={{ transform: 'rotateY(7deg) rotateZ(-1.5deg)', transformOrigin: 'left center' }}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${n}: ${current.topic}`}
        >
          <WorldTile theme={current.theme} className="absolute inset-0 h-full w-full" iconSize={110} />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-12">
            <div className="flex flex-wrap items-center gap-2">
              {current.tags.map((t, i) => (
                <span key={t} className={i === 0 ? 'font-display text-2xl text-plasma-300' : 'rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold tracking-[0.14em] text-ink-50 backdrop-blur'}>
                  {i === 0 ? t : t.toUpperCase()}
                </span>
              ))}
            </div>
            <h3 className="mt-3 max-w-3xl font-display text-6xl text-white sm:text-8xl">{current.topic}</h3>
            <p className="mt-4 max-w-md text-sm font-medium uppercase tracking-[0.08em] text-ink-200">{current.blurb}</p>
            {sampleFor(current.topic) ? (
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button onClick={() => onLaunch(current.topic)} className="btn-launch" aria-label={`Play lesson: ${current.topic}`}>
                  <Play className="h-3.5 w-3.5 fill-current" /> Play
                </button>
                <span className="text-sm text-ink-200">Ready to watch, about a minute</span>
              </div>
            ) : (
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button onClick={() => onLaunch(current.topic)} className="btn-launch" aria-label={`Make lesson: ${current.topic}`}>
                  <Wand2 className="h-3.5 w-3.5" /> Make it
                </button>
                <span className="text-sm text-ink-200">Takes about a minute to make</span>
              </div>
            )}
          </div>
        </div>

        {/* controls */}
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-4 sm:right-6">
          {[{ d: 1, Icon: ChevronRight, label: 'Next lesson' }, { d: -1, Icon: ChevronLeft, label: 'Previous lesson' }].map(({ d, Icon, label }) => (
            <button
              key={label}
              onClick={() => go(d)}
              aria-label={label}
              className="flex h-14 w-14 items-center justify-center rounded-full text-white transition hover:scale-105 active:scale-95 sm:h-16 sm:w-16"
              style={{ background: 'linear-gradient(#050506cc, #050506cc) padding-box, linear-gradient(135deg, #8FF7FF, #8A4FD6, #3EBDD4) border-box', border: '2px solid transparent' }}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
        </div>

        <div className="absolute bottom-6 right-4 hidden flex-col items-end gap-3 sm:right-8 md:flex">
          {onSeeAll && (
            <button onClick={onSeeAll} className="flex items-center gap-1 text-sm font-semibold tracking-[0.16em] text-white hover:text-neon-200">
              SEE ALL LESSONS <Play className="h-3 w-3 fill-current" />
            </button>
          )}
          <div className="flex gap-2">
            {SHOWCASE.map((s, i) => (
              <button
                key={s.topic}
                onClick={() => setIndex(i)}
                aria-label={`Show ${s.topic}`}
                aria-current={i === index}
                className={`h-14 w-20 overflow-hidden rounded-lg transition ${i === index ? 'ring-2 ring-white' : 'opacity-60 hover:opacity-100'}`}
              >
                <WorldTile theme={s.theme} className="h-full w-full" iconSize={18} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- mirrored wordmark moment

function MirrorType() {
  const { ref, shown } = useReveal<HTMLDivElement>(0.4);
  const line = 'font-display block whitespace-nowrap text-center text-[11vw] leading-[0.8] transition-transform duration-700 ease-out sm:text-[8vw]';
  return (
    <div ref={ref} className="relative overflow-hidden py-10" aria-hidden="true">
      <span className={`${line} text-white`} style={{ transform: shown ? 'scaleY(1)' : 'scaleY(0.4)' }}>VideoMind</span>
      <div className="relative z-10 mx-auto my-2 flex max-w-5xl items-center gap-2 px-6">
        <span className="h-1.5 w-1.5 rotate-45 bg-white" />
        <span className="h-px flex-1 bg-gradient-to-r from-white via-plasma-400 to-white" />
        <span className="h-1.5 w-1.5 rotate-45 bg-white" />
      </div>
      <span className={`${line} text-white/70`} style={{ transform: shown ? 'scaleY(-0.7)' : 'scaleY(-0.2)', WebkitMaskImage: 'linear-gradient(to top, transparent, #000 90%)', maskImage: 'linear-gradient(to top, transparent, #000 90%)' }}>VideoMind</span>
    </div>
  );
}

// ---------------------------------------------------------------- page

export default function HomePage({ busy, language, onLanguageChange, onSummarize, onMakeLesson, onOpenLibraryItem, onOpenLessons, onPlayLesson }: HomePageProps) {
  const play = onPlayLesson || onMakeLesson;
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('video');
  const [value, setValue] = useState('');
  const [recent, setRecent] = useState<LibraryItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const worlds = useReveal<HTMLElement>(0.1);

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

  return (
    <div>
      {/* ------------------------------------------------ hero */}
      <section className="relative isolate flex min-h-[92dvh] flex-col justify-center overflow-hidden pb-16 pt-24 sm:justify-end sm:pt-28">
        <PortalArt />
        <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-10">
          <h1 className="font-display text-[2.7rem] text-white sm:text-7xl lg:text-[7.5rem]">
            <span className="sr-only">Learn anything, in your language.</span>
            <span aria-hidden="true" className="block">Learn anything,</span>
            <CyclingLine />
            <span aria-hidden="true" className="block">in your language.</span>
          </h1>

          <form onSubmit={submit} className="glass mt-6 max-w-3xl rounded-2xl p-2 sm:mt-8">
            <div role="tablist" aria-label="What do you want to do?" className="flex gap-1 p-1">
              {([['video', 'Summarize a video', Youtube], ['lesson', 'Make a lesson', PenLine]] as const).map(([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => pickMode(m)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${mode === m ? 'bg-neon-400 text-white' : 'text-ink-300 hover:text-white'}`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
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
                  className="w-full rounded-xl bg-white/5 px-4 py-3.5 text-base text-white placeholder-ink-400 focus:bg-white/10 focus:outline-none"
                />
              </label>
              <label className="relative flex items-center" title="Output language">
                <span className="sr-only">Output language</span>
                <Languages className="pointer-events-none absolute left-3 h-4 w-4 text-ink-400" />
                <select
                  value={language}
                  onChange={(e) => onLanguageChange(e.target.value)}
                  disabled={busy}
                  className="w-full appearance-none rounded-xl bg-white/5 py-3.5 pl-9 pr-4 text-ink-100 focus:outline-none sm:w-auto"
                >
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code} className="bg-ink-900">{l.native}</option>)}
                </select>
              </label>
              <button type="submit" disabled={busy || !value.trim()} className="btn-neon">
                {mode === 'video' ? (busy ? 'Working…' : 'Summarize') : 'Plan the lesson'}
              </button>
            </div>
          </form>

          <div className="mt-5 flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-3">
            <button onClick={() => play('Photosynthesis')} className="flex items-center gap-2 text-sm font-semibold text-white hover:text-neon-200">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink-950"><Play className="h-3.5 w-3.5 fill-current" /></span>
              Watch a 1-minute sample lesson
            </button>
            <p className="text-sm text-ink-300">
              {mode === 'video'
                ? 'Get the transcript, a summary, notes and a tutor that answers with timestamps.'
                : 'A narrated lesson with drawn slides or AI pictures, in 15 languages.'}
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ recent */}
      {recent.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-5 pt-16 sm:px-10" aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="font-display text-5xl text-white">Pick up where you left off</h2>
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((item) => (
              <li key={item.analysisId}>
                <button onClick={() => onOpenLibraryItem(item)} className="group chamfer block w-full overflow-hidden bg-ink-900 text-left transition hover:-translate-y-1">
                  <div className="aspect-video overflow-hidden">
                    {item.thumbnail
                      ? <img src={item.thumbnail} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      : <div className="flex h-full items-center justify-center bg-ink-800"><PlayCircle className="h-8 w-8 text-ink-500" /></div>}
                  </div>
                  <p className="line-clamp-2 px-4 py-3 text-sm text-ink-100">{item.title}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------ showcase */}
      <div className="pt-20">
        <h2 className="mx-auto mb-6 max-w-[1400px] px-5 font-display text-5xl text-white sm:px-10 sm:text-6xl">Watch a lesson</h2>
        <Showcase onLaunch={play} onSeeAll={onOpenLessons} />
      </div>

      {/* ------------------------------------------------ the mirrored wordmark */}
      <MirrorType />

      {/* ------------------------------------------------ worlds */}
      <section
        ref={worlds.ref}
        aria-labelledby="worlds-heading"
        className={`mx-auto max-w-[1400px] px-5 pb-24 transition duration-700 sm:px-10 ${worlds.shown ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="worlds-heading" className="font-display text-5xl text-white sm:text-6xl">Choose a world</h2>
          <p className="max-w-md text-ink-300">Pick a topic and VideoMind writes and narrates a lesson on it. Making one takes about a minute.</p>
        </div>
        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {WORLDS.map((w) => (
            <li key={w.name} className="group chamfer-lg relative overflow-hidden border border-white/10 bg-ink-900 transition duration-300 hover:-translate-y-1.5 hover:border-white/25">
              <div className="aspect-[4/3] overflow-hidden">
                <WorldTile theme={w.theme} className="h-full w-full transition-transform duration-500 group-hover:scale-105" iconSize={64} />
              </div>
              <div className="p-5">
                <h3 className="font-display-wide text-lg text-white">{w.name}</h3>
                <p className="mt-2 text-xs text-ink-400">Make a lesson about…</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {w.topics.map((t) => (
                    <button
                      key={t}
                      onClick={() => onMakeLesson(t)}
                      className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-ink-200 transition hover:border-neon-300 hover:bg-neon-400/10 hover:text-white"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-6 px-5 py-10 text-sm text-ink-400 sm:px-10">
          <span className="font-display text-3xl text-white">VideoMind</span>
          <span className="mr-auto">Free and open source. Summaries, study tools and video lessons in 15 languages.</span>
          <a href="https://github.com/Yashwanthdot7/VedioMind-AI" target="_blank" rel="noreferrer" className="tracking-[0.14em] hover:text-white">SOURCE CODE</a>
        </div>
      </footer>
    </div>
  );
}
