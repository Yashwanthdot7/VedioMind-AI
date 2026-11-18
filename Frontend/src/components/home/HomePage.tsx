import { FormEvent, useEffect, useState } from 'react';
import { Youtube, PenLine, Languages, PlayCircle, Clapperboard } from 'lucide-react';
import { LANGUAGES } from '../../constants/languages';
import { useAuth } from '../../context/AuthContext';
import { getLibrary } from '../../services/apiService';
import { LibraryItem } from '../../types';
import { LampMark } from '../shell/Sidebar';

/** "Learn anything," in six Indian scripts; the line settles on the last one */
const SCRIPTS = [
  { text: 'कुछ भी सीखिए,', lang: 'hi' },
  { text: 'ಏನನ್ನಾದರೂ ಕಲಿಯಿರಿ,', lang: 'kn' },
  { text: 'எதையும் கற்றுக்கொள்ளுங்கள்,', lang: 'ta' },
  { text: 'ఏదైనా నేర్చుకోండి,', lang: 'te' },
  { text: 'എന്തും പഠിക്കൂ,', lang: 'ml' },
  { text: 'যেকোনো কিছু শিখুন,', lang: 'bn' },
];

const TOPICS = ['Why is the sky blue?', 'Photosynthesis', 'How a computer stores numbers', 'The water cycle'];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function CyclingLine() {
  const [i, setI] = useState(() => (prefersReducedMotion() ? SCRIPTS.length - 1 : 0));
  useEffect(() => {
    if (i >= SCRIPTS.length - 1) return;
    const id = window.setTimeout(() => setI((n) => n + 1), 900);
    return () => window.clearTimeout(id);
  }, [i]);
  const s = SCRIPTS[i];
  return (
    <span className={`block text-[0.82em] font-narrow text-turmeric-400 ${i < SCRIPTS.length - 1 ? 'min-h-[2.6em] sm:min-h-[1.3em]' : ''}`} aria-hidden="true">
      <span key={s.lang} lang={s.lang} className="inline-block animate-script-in">{s.text}</span>
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
}

export default function HomePage({ busy, language, onLanguageChange, onSummarize, onMakeLesson, onOpenLibraryItem }: HomePageProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('video');
  const [value, setValue] = useState('');
  const [recent, setRecent] = useState<LibraryItem[]>([]);

  useEffect(() => {
    if (!user) { setRecent([]); return; }
    getLibrary().then((items) => setRecent(items.slice(0, 3))).catch(() => {});
  }, [user]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    if (mode === 'video') onSummarize(v);
    else onMakeLesson(v);
  };

  const tab = (m: Mode) => `flex items-center gap-2 whitespace-nowrap px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    mode === m ? 'bg-ink-800 text-ink-50' : 'text-ink-400 hover:text-ink-100'
  }`;

  return (
    <div className="max-w-5xl mx-auto px-5 lg:px-10 pt-6 lg:pt-24 pb-28">
      <div className="lg:hidden mb-10 flex items-center gap-2 text-turmeric-400">
        <LampMark className="w-7 h-7" />
        <span className="font-wide font-extrabold text-lg text-ink-50">VideoMind</span>
      </div>
      <h1 className="font-wide font-extrabold leading-[1.14] tracking-tight text-[2.15rem] sm:text-6xl lg:text-7xl text-ink-50">
        <span className="sr-only">Learn anything, in your language.</span>
        <span aria-hidden="true" className="block">Learn anything,</span>
        <CyclingLine />
        <span aria-hidden="true" className="block">in your language.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-300">
        Paste a YouTube link to get the transcript, a summary and a tutor you can question. Or type a topic and get a narrated video lesson.
      </p>

      <form onSubmit={submit} className="mt-10 rounded-panel bg-ink-900 border border-ink-800 p-3 sm:p-4">
        <div role="tablist" aria-label="What do you want to do?" className="flex gap-1 mb-3">
          <button type="button" role="tab" aria-selected={mode === 'video'} onClick={() => setMode('video')} className={tab('video')}>
            <Youtube className="w-4 h-4" /> <span>Summarize<span className="hidden sm:inline"> a video</span></span>
          </button>
          <button type="button" role="tab" aria-selected={mode === 'lesson'} onClick={() => setMode('lesson')} className={tab('lesson')}>
            <PenLine className="w-4 h-4" /> <span className="sm:hidden">Lesson</span><span className="hidden sm:inline">Make a video lesson</span>
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="flex-1">
            <span className="sr-only">{mode === 'video' ? 'YouTube link' : 'Lesson topic'}</span>
            <input
              type="text"
              inputMode={mode === 'video' ? 'url' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy}
              placeholder={mode === 'video' ? 'https://www.youtube.com/watch?v=…' : 'A topic, or paste your notes'}
              className="w-full px-4 py-3.5 rounded-xl bg-ink-950 border border-ink-800 text-ink-50 placeholder-ink-500 focus:outline-none focus:border-turmeric-400/70 text-base"
            />
          </label>
          <label className="relative flex items-center" title="Output language">
            <span className="sr-only">Output language</span>
            <Languages className="absolute left-3 w-4 h-4 text-ink-500 pointer-events-none" />
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              disabled={busy}
              className="appearance-none w-full sm:w-auto pl-9 pr-4 py-3.5 rounded-xl bg-ink-950 border border-ink-800 text-ink-200 focus:outline-none focus:border-turmeric-400/70"
            >
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="px-6 py-3.5 rounded-xl bg-turmeric-400 hover:bg-turmeric-300 text-ink-950 font-semibold disabled:bg-ink-800 disabled:text-ink-500 transition-colors"
          >
            {mode === 'video' ? (busy ? 'Working…' : 'Summarize') : 'Plan the lesson'}
          </button>
        </div>
      </form>

      <section className="mt-12" aria-labelledby="next-heading">
        {recent.length > 0 ? (
          <>
            <h2 id="next-heading" className="font-semiwide font-semibold text-ink-200 mb-4">Pick up where you left off</h2>
            <ul className="grid sm:grid-cols-3 gap-3">
              {recent.map((item) => (
                <li key={item.analysisId}>
                  <button onClick={() => onOpenLibraryItem(item)} className="group w-full text-left rounded-xl border border-ink-800 hover:border-ink-600 overflow-hidden transition-colors">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt="" className="w-full aspect-video object-cover opacity-90 group-hover:opacity-100" />
                    ) : (
                      <div className="w-full aspect-video bg-ink-900 flex items-center justify-center"><PlayCircle className="w-8 h-8 text-ink-600" /></div>
                    )}
                    <p className="px-3 py-2.5 text-sm text-ink-200 line-clamp-2">{item.title}</p>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h2 id="next-heading" className="font-semiwide font-semibold text-ink-200 mb-4">Or start with a topic</h2>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => onMakeLesson(t)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-ink-700 text-sm text-ink-200 hover:border-turmeric-400/60 hover:text-turmeric-200 transition-colors"
                >
                  <Clapperboard className="w-4 h-4 text-ink-500" /> {t}
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
