import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Clapperboard, Sparkles, Youtube, PenLine, Loader2, CheckCircle2, AlertCircle, Trash2, ArrowLeft, Mic, Wand2, Image as ImageIcon, LayoutTemplate,
} from 'lucide-react';
import { Lesson, LessonAudience, LessonSummary, VideoData } from '../../types';
import {
  createLesson, deleteLesson, getLesson, getLessonOptions, listLessons, LessonOptions,
} from '../../services/apiService';
import { LANGUAGES, languageLabel } from '../../constants/languages';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/errors';
import LessonPlayer from './LessonPlayer';

interface LessonsPageProps {
  /** The video open on the dashboard, offered as a source */
  currentVideo: VideoData | null;
  /** Pre-select "from this video" when coming from the dashboard */
  preferVideo: boolean;
  defaultLanguage: string;
}

const AUDIENCES: { value: LessonAudience; label: string; hint: string }[] = [
  { value: 'kids', label: '🧒 Kids', hint: 'Simple words, fun examples' },
  { value: 'student', label: '🎓 Student', hint: 'Clear, exam-focused' },
  { value: 'teacher', label: '🧑‍🏫 Teacher', hint: 'Ready to show in class' },
];

const EXAMPLES = [
  'Why is the sky blue?',
  'Photosynthesis: how plants make food',
  'The water cycle',
  'How does a computer store data in binary?',
];

const RECENT_KEY = 'videomind.recentLessons';

/** Guests have no account, so remember their lessons in this browser */
function loadRecent(): LessonSummary[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function rememberRecent(lesson: Lesson) {
  try {
    const item: LessonSummary = {
      id: lesson.id, title: lesson.title, icon: lesson.scenes[0]?.icon || '🎬', status: lesson.status,
      progress: lesson.progress, language: lesson.language, audience: lesson.audience,
      durationSec: lesson.durationSec, createdAt: lesson.createdAt,
    };
    const list = [item, ...loadRecent().filter((l) => l.id !== lesson.id)].slice(0, 20);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

function ProgressView({ lesson }: { lesson: Lesson }) {
  const n = lesson.scenes.length;
  const voiced = lesson.scenes.filter((s) => s.audio).length;
  const pictured = lesson.scenes.filter((s) => s.imageStatus === 'done' || s.imageStatus === 'failed').length;
  const wantsPictures = lesson.visuals !== 'slides' && lesson.scenes.some((s) => s.imageStatus && s.imageStatus !== 'skipped');
  const scripting = lesson.status === 'queued' || lesson.status === 'scripting';
  const working = lesson.status === 'voice';

  type Step = { label: string; icon: typeof PenLine; state: 'done' | 'active' | 'todo' };
  const steps: Step[] = [
    { label: 'Writing the script', icon: PenLine, state: scripting ? 'active' : 'done' },
  ];
  if (wantsPictures || (scripting && lesson.visuals !== 'slides')) {
    steps.push({
      label: n ? `Drawing pictures (${pictured}/${n} scenes)` : 'Drawing pictures',
      icon: ImageIcon,
      state: scripting ? 'todo' : pictured >= n && n > 0 ? 'done' : 'active',
    });
  }
  steps.push({
    label: n ? `Recording narration (${voiced}/${n} scenes)` : 'Recording narration',
    icon: Mic,
    state: scripting ? 'todo' : (working && (voiced < n && lesson.voiceMode !== 'browser')) ? 'active' : 'done',
  });
  steps.push({ label: 'Lesson ready', icon: CheckCircle2, state: lesson.status === 'done' ? 'done' : 'todo' });

  return (
    <div className="max-w-lg mx-auto py-10 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 shadow-lg shadow-indigo-500/30">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
      <h2 className="text-2xl font-bold text-slate-100 mb-1">Creating your video lesson</h2>
      <p className="text-sm text-slate-400 mb-6">
        This usually takes 1–3 minutes{wantsPictures ? ' (pictures can take a little longer on the free tier)' : ''}. You can stay on this page.
      </p>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-700" style={{ width: `${Math.max(4, lesson.progress)}%` }} />
      </div>
      <div className="space-y-2 text-left">
        {steps.map((step) => {
          const Icon = step.state === 'done' ? CheckCircle2 : step.icon;
          return (
            <div key={step.label} className={`flex items-center gap-3 p-3 rounded-lg border ${
              step.state === 'done' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : step.state === 'active' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200'
                  : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
            }`}>
              {step.state === 'active' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
              <span className="text-sm font-medium">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LessonsPage({ currentVideo, preferVideo, defaultLanguage }: LessonsPageProps) {
  const { user } = useAuth();
  const [options, setOptions] = useState<LessonOptions | null>(null);
  const [source, setSource] = useState<'text' | 'video'>(currentVideo && preferVideo ? 'video' : 'text');
  const [text, setText] = useState('');
  const [audience, setAudience] = useState<LessonAudience>('student');
  const [language, setLanguage] = useState(defaultLanguage);
  const [length, setLength] = useState<'short' | 'standard'>('short');
  const [voice, setVoice] = useState<string>('');
  const [visuals, setVisuals] = useState<'pictures' | 'slides'>('pictures');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState<Lesson | null>(null);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const pollRef = useRef<number>(0);

  useEffect(() => {
    getLessonOptions().then(setOptions).catch(() => {});
  }, []);

  const refreshList = useCallback(async () => {
    if (user) {
      try {
        setLessons(await listLessons());
      } catch {
        /* list is optional */
      }
    } else {
      setLessons(loadRecent());
    }
  }, [user]);

  useEffect(() => { refreshList(); }, [refreshList]);

  // Poll an unfinished lesson until it's done
  const watch = useCallback((lesson: Lesson) => {
    window.clearTimeout(pollRef.current);
    setActive(lesson);
    if (!user) rememberRecent(lesson);
    if (lesson.status === 'done' || lesson.status === 'failed') {
      refreshList();
      return;
    }
    pollRef.current = window.setTimeout(async () => {
      try {
        watch(await getLesson(lesson.id));
      } catch (err) {
        setActive({ ...lesson, status: 'failed', error: errorMessage(err) });
      }
    }, 2000);
  }, [user, refreshList]);

  useEffect(() => () => window.clearTimeout(pollRef.current), []);

  const open = async (id: string) => {
    setError(null);
    try {
      watch(await getLesson(id));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (item: LessonSummary) => {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    try {
      if (user) await deleteLesson(item.id);
      else {
        localStorage.setItem(RECENT_KEY, JSON.stringify(loadRecent().filter((l) => l.id !== item.id)));
      }
      if (active?.id === item.id) setActive(null);
      refreshList();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const lesson = await createLesson({
        text: source === 'text' ? text : undefined,
        video: source === 'video' && currentVideo ? currentVideo : undefined,
        audience,
        language,
        length,
        voice: voice || undefined,
        visuals: options && !options.pictures ? 'slides' : visuals,
      });
      watch(lesson);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !submitting && (source === 'video' ? Boolean(currentVideo) : text.trim().length >= 15);

  // ---------------------------------------------------------------- active lesson
  if (active) {
    return (
      <div className="max-w-5xl mx-auto">
        <button onClick={() => { window.clearTimeout(pollRef.current); setActive(null); refreshList(); }} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-4">
          <ArrowLeft className="w-4 h-4" /> All video lessons
        </button>

        {active.status === 'done' ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="mb-4">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-100">{active.title}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {AUDIENCES.find((a) => a.value === active.audience)?.label} · {languageLabel(active.language)}
                {active.sourceVideo && <> · from “{active.sourceVideo.title}”</>}
              </p>
            </div>
            <LessonPlayer key={active.id} lesson={active} />
          </motion.div>
        ) : active.status === 'failed' ? (
          <div className="max-w-lg mx-auto py-16 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-red-300">{active.error || 'Something went wrong while creating the lesson.'}</p>
            <button onClick={() => setActive(null)} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm">Try again</button>
          </div>
        ) : (
          <ProgressView lesson={active} />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- create form
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Clapperboard className="w-7 h-7 text-indigo-400" />
        <h1 className="text-3xl font-bold text-slate-100">Create a video lesson</h1>
      </div>
      <p className="text-slate-400 mb-8">Turn any topic, notes or YouTube video into a narrated, animated lesson — in {LANGUAGES.length} languages, for kids, students or teachers. Free.</p>

      <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5 md:p-6 space-y-6">
        {/* source */}
        <div>
          <div className="flex gap-2 mb-3" role="tablist">
            <button
              role="tab" aria-selected={source === 'text'} onClick={() => setSource('text')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${source === 'text' ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60'}`}
            >
              <PenLine className="w-4 h-4" /> Topic or text
            </button>
            <button
              role="tab" aria-selected={source === 'video'} onClick={() => setSource('video')} disabled={!currentVideo}
              title={currentVideo ? undefined : 'Summarize a YouTube video first'}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${source === 'video' ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60'}`}
            >
              <Youtube className="w-4 h-4" /> From a YouTube video
            </button>
          </div>

          {source === 'text' ? (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                maxLength={20000}
                placeholder="Type a topic (e.g. “How do volcanoes erupt?”) or paste your notes, a textbook paragraph, or an article…"
                className="w-full p-4 bg-slate-950/60 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                aria-label="Topic or text for the lesson"
              />
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-xs text-slate-500">Try:</span>
                {EXAMPLES.map((ex) => (
                  <button key={ex} onClick={() => setText(ex)} className="px-2.5 py-1 text-xs rounded-full border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500">
                    {ex}
                  </button>
                ))}
                <span className="ml-auto text-xs text-slate-600">{text.length.toLocaleString()} / 20,000</span>
              </div>
            </>
          ) : currentVideo ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-700/50">
              <img src={currentVideo.metadata?.thumbnail || `https://i.ytimg.com/vi/${currentVideo.videoId}/mqdefault.jpg`} alt="" className="w-28 rounded-lg" />
              <div className="min-w-0">
                <p className="text-sm text-slate-200 font-medium line-clamp-2">{currentVideo.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">The lesson will be based on this video’s transcript</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Who is it for?</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Audience">
              {AUDIENCES.map((a) => (
                <button
                  key={a.value} role="radio" aria-checked={audience === a.value} onClick={() => setAudience(a.value)}
                  className={`p-2.5 rounded-xl border text-left ${audience === a.value ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'}`}
                >
                  <p className="text-sm text-slate-200 font-medium">{a.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{a.hint}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Language</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {LANGUAGES.map((l) => <option key={l.code} value={l.code} className="bg-slate-900">{l.native}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Length</span>
              <select value={length} onChange={(e) => setLength(e.target.value as 'short' | 'standard')} className="w-full px-3 py-2.5 bg-slate-950/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="short" className="bg-slate-900">Short (~1 min)</option>
                <option value="standard" className="bg-slate-900">Standard (~2–3 min)</option>
              </select>
            </label>
            <label className="block col-span-2">
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Narrator voice</span>
              <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="" className="bg-slate-900">Automatic (best for the audience)</option>
                {options && Object.entries(options.voices).map(([name, label]) => (
                  <option key={name} value={name} className="bg-slate-900">{name} — {label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Visual style</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl" role="radiogroup" aria-label="Visual style">
            {[
              { value: 'pictures' as const, icon: ImageIcon, label: 'AI pictures', hint: 'A generated illustration in every scene' },
              { value: 'slides' as const, icon: LayoutTemplate, label: 'Simple slides', hint: 'Animated text slides, fastest' },
            ].map((v) => {
              const disabled = v.value === 'pictures' && options !== null && !options.pictures;
              const selected = (disabled ? 'slides' : visuals) === v.value;
              return (
                <button
                  key={v.value} role="radio" aria-checked={selected} disabled={disabled} onClick={() => setVisuals(v.value)}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left disabled:opacity-40 ${selected ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'}`}
                >
                  <v.icon className="w-5 h-5 text-indigo-300 mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-sm text-slate-200 font-medium">{v.label}</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">{disabled ? 'Not available on this server' : v.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold shadow-lg shadow-indigo-600/20"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            Create video lesson
          </button>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Free: AI script &amp; narration (Gemini) · AI pictures ({options?.pictureProvider === 'cloudflare' ? 'Cloudflare FLUX' : 'Pollinations FLUX'}) · quiz at the end
          </p>
        </div>
      </div>

      {/* my lessons */}
      {lessons.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">{user ? 'Your video lessons' : 'Recent lessons on this browser'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lessons.map((item) => (
              <div key={item.id} className="group flex items-center gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800/60 hover:border-indigo-500/40 transition-colors">
                <button onClick={() => open(item.id)} className="flex-1 flex items-center gap-3 min-w-0 text-left">
                  <span className="text-3xl">{item.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-200 truncate">{item.title}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {item.status === 'done' ? `${AUDIENCES.find((a) => a.value === item.audience)?.label} · ${languageLabel(item.language)}`
                        : item.status === 'failed' ? 'Failed' : `Creating… ${item.progress}%`}
                    </span>
                  </span>
                </button>
                <button onClick={() => remove(item)} className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Delete ${item.title}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
