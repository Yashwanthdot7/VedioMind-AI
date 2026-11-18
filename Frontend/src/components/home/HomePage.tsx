import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Languages, PlayCircle, ChevronRight, ChevronLeft, Play, ListTree, Youtube } from 'lucide-react';
import { LANGUAGES } from '../../constants/languages';
import { useAuth } from '../../context/AuthContext';
import { getLibrary } from '../../services/apiService';
import { LibraryItem } from '../../types';
import { useReveal } from '../../hooks/useReveal';
import PortalArt from '../art/PortalArt';
import WorldTile from '../art/WorldTile';
import { SHOWCASE, WORLDS } from './topics';

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
}

// ---------------------------------------------------------------- showcase carousel

function Showcase({ onLaunch, onSeeAll }: { onLaunch: (topic: string) => void; onSeeAll?: () => void }) {
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
            <button onClick={() => onLaunch(current.topic)} className="btn-launch mt-6" aria-label={`Launch lesson: ${current.topic}`}>Launch</button>
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
              style={{ background: 'linear-gradient(#0B0716cc, #0B0716cc) padding-box, linear-gradient(135deg, #F29BFF, #7650FF, #3EBDD4) border-box', border: '2px solid transparent' }}
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
  const { ref, shown } = useReveal<HTMLDivElement>(0.3);
  const line = 'font-display block whitespace-nowrap text-center text-[19vw] leading-[0.8] transition-transform duration-[1100ms] ease-out';
  return (
    <div ref={ref} className="relative overflow-hidden py-16 [perspective:900px]" aria-hidden="true">
      <span className={`${line} text-ink-50/70`} style={{ transform: shown ? 'rotateX(48deg) scaleY(0.62)' : 'rotateX(80deg) scaleY(0.2)' }}>VideoMind</span>
      <span className={`${line} text-white`} style={{ transform: shown ? 'scaleY(1)' : 'scaleY(0.3)' }}>VideoMind</span>
      <div className="relative z-10 mx-auto my-3 flex max-w-5xl items-center gap-2 px-6">
        <span className="h-2 w-2 rotate-45 bg-white" />
        <span className="h-px flex-1 bg-gradient-to-r from-white via-plasma-400 to-white" />
        <span className="h-2 w-2 rotate-45 bg-white" />
      </div>
      <span className={`${line} text-white/90`} style={{ transform: shown ? 'scaleY(-1)' : 'scaleY(-0.3)', WebkitMaskImage: 'linear-gradient(to top, transparent, #000 85%)', maskImage: 'linear-gradient(to top, transparent, #000 85%)' }}>VideoMind</span>
      <span className={`${line} text-ink-50/40`} style={{ transform: shown ? 'rotateX(-48deg) scaleY(-0.62)' : 'rotateX(-80deg) scaleY(-0.2)' }}>VideoMind</span>
    </div>
  );
}

// ---------------------------------------------------------------- page

export default function HomePage({ busy, language, onLanguageChange, onSummarize, onMakeLesson, onOpenLibraryItem, onOpenLessons }: HomePageProps) {
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
      <section className="relative isolate flex min-h-[100dvh] flex-col justify-end overflow-hidden pb-28 pt-28">
        <PortalArt />
        <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-10">
          <h1 className="font-display text-[3.4rem] text-white sm:text-8xl lg:text-[8.5rem]">
            <span className="sr-only">Learn anything, in your language.</span>
            <span aria-hidden="true" className="block">Learn anything,</span>
            <CyclingLine />
            <span aria-hidden="true" className="block">in your language.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-200">
            Paste a YouTube link for the transcript, a summary and a tutor you can question. Or type a topic and get a narrated video lesson.
          </p>

          <form onSubmit={submit} className="glass mt-8 flex max-w-3xl flex-col gap-2 rounded-2xl p-2 sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">{mode === 'video' ? 'YouTube link' : 'Lesson topic'}</span>
              <input
                ref={inputRef}
                type="text"
                inputMode={mode === 'video' ? 'url' : 'text'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={busy}
                placeholder={mode === 'video' ? 'https://www.youtube.com/watch?v=…' : 'A topic, or paste your notes'}
                className="w-full rounded-xl bg-transparent px-4 py-3.5 text-base text-white placeholder-ink-400 focus:outline-none"
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
            <button type="submit" disabled={busy || !value.trim()} className="btn-neon uppercase tracking-[0.14em]">
              {mode === 'video' ? (busy ? 'Working…' : 'Summarize') : 'Plan the lesson'}
            </button>
          </form>

          {/* feature cards */}
          <div className="mt-10 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
            <button onClick={() => pickMode('video')} className="group chamfer flex items-stretch overflow-hidden bg-ink-900/80 text-left backdrop-blur transition hover:-translate-y-1">
              <div className="w-28 shrink-0 overflow-hidden sm:w-36">
                <WorldTile theme={{ from: '#E040FB', to: '#7650FF', icon: Youtube, seed: 2 }} className="h-full w-full transition-transform duration-500 group-hover:scale-110" iconSize={34} />
              </div>
              <div className="p-4">
                <p className="font-display-wide text-sm text-white">Any video</p>
                <p className="mt-1 text-sm text-ink-300">Transcript, summary, notes, quiz and a tutor that answers with timestamps.</p>
              </div>
            </button>
            <button onClick={onOpenLessons || (() => pickMode('lesson'))} className="group chamfer flex items-stretch overflow-hidden bg-ink-900/80 text-left backdrop-blur transition hover:-translate-y-1">
              <div className="w-28 shrink-0 overflow-hidden sm:w-36">
                <WorldTile theme={{ from: '#3EBDD4', to: '#7650FF', icon: ListTree, seed: 9 }} className="h-full w-full transition-transform duration-500 group-hover:scale-110" iconSize={34} />
              </div>
              <div className="p-4">
                <p className="font-display-wide text-sm text-white">Lessons and courses</p>
                <p className="mt-1 text-sm text-ink-300">A topic, your notes or a PDF chapter, turned into narrated video lessons.</p>
              </div>
            </button>
          </div>
        </div>

        {/* currently viewing */}
        <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center px-4">
          <div role="tablist" aria-label="What do you want to do?" className="glass flex items-center gap-2 rounded-full p-1.5 pl-4">
            <span className="hidden text-sm font-semibold tracking-[0.14em] text-ink-100 sm:inline">CURRENTLY VIEWING:</span>
            {([['video', 'Video', 'Summarize a video'], ['lesson', 'Lesson', 'Make a video lesson']] as const).map(([m, label, full]) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                aria-label={full}
                onClick={() => pickMode(m)}
                className={`rounded-full px-6 py-2 text-sm font-bold tracking-[0.14em] transition ${mode === m ? 'bg-neon-400 text-white shadow-[0_0_24px_-4px_#7650FF]' : 'bg-white/5 text-ink-300 hover:text-white'}`}
              >
                {label.toUpperCase()}
              </button>
            ))}
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
        <h2 className="mx-auto mb-6 max-w-[1400px] px-5 font-display text-5xl text-white sm:px-10 sm:text-6xl">Start with a lesson</h2>
        <Showcase onLaunch={onMakeLesson} onSeeAll={onOpenLessons} />
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
          <p className="max-w-md text-ink-300">Pick a topic and VideoMind plans, writes and narrates the lesson, with pictures for every scene.</p>
        </div>
        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {WORLDS.map((w) => (
            <li key={w.name} className="group chamfer-lg relative overflow-hidden border border-white/10 bg-ink-900 transition duration-300 hover:-translate-y-1.5 hover:border-white/25">
              <div className="aspect-[4/3] overflow-hidden">
                <WorldTile theme={w.theme} className="h-full w-full transition-transform duration-500 group-hover:scale-105" iconSize={64} />
              </div>
              <div className="p-5">
                <h3 className="font-display-wide text-lg text-white">{w.name}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
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
