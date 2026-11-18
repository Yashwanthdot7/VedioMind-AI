import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Clapperboard, Sparkles, Youtube, PenLine, Loader2, AlertCircle, Trash2, ArrowLeft, Wand2, Image as ImageIcon, LayoutTemplate, ListTree, Film, FileUp,
} from 'lucide-react';
import { Course, CourseSummary, Lesson, LessonAudience, LessonSummary, VideoData } from '../../types';
import {
  createCourse, createLesson, deleteCourse, deleteLesson, getCourse, getLesson, getLessonOptions, listCourses, listLessons, LessonOptions,
} from '../../services/apiService';
import { LANGUAGES, languageLabel } from '../../constants/languages';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/errors';
import LessonPlayer from './LessonPlayer';
import LessonProgress from './LessonProgress';
import CoursePlayer from './CoursePlayer';
import ShareButton from '../share/ShareButton';
import FileSource, { UploadedFile } from './FileSource';

interface LessonsPageProps {
  /** The video open on the dashboard, offered as a source */
  currentVideo: VideoData | null;
  /** Pre-select "from this video" when coming from the dashboard */
  preferVideo: boolean;
  defaultLanguage: string;
  /** Topic typed on the home page */
  initialText?: string;
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
/** Keep in sync with MAX_TEXT in backend/src/controllers/lessonInput.js */
const MAX_TEXT = 100000;
const LONG_FOR_ONE_LESSON = 15000;

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

const RECENT_COURSES_KEY = 'videomind.recentCourses';

function loadRecentCourses(): CourseSummary[] {
  try {
    const raw = localStorage.getItem(RECENT_COURSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function rememberCourse(course: Course) {
  try {
    const item: CourseSummary = {
      id: course.id, title: course.title, status: course.status, language: course.language,
      audience: course.audience, moduleCount: course.modules.length || course.moduleCount, createdAt: course.createdAt,
    };
    const list = [item, ...loadRecentCourses().filter((c) => c.id !== course.id)].slice(0, 20);
    localStorage.setItem(RECENT_COURSES_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

export default function LessonsPage({ currentVideo, preferVideo, defaultLanguage, initialText = '' }: LessonsPageProps) {
  const { user } = useAuth();
  const [options, setOptions] = useState<LessonOptions | null>(null);
  const [source, setSource] = useState<'text' | 'file' | 'video'>(currentVideo && preferVideo ? 'video' : 'text');
  const [upload, setUpload] = useState<UploadedFile | null>(null);
  const [text, setText] = useState(initialText);
  const [audience, setAudience] = useState<LessonAudience>('student');
  const [language, setLanguage] = useState(defaultLanguage);
  const [length, setLength] = useState<'short' | 'standard'>('short');
  const [voice, setVoice] = useState<string>('');
  const [visuals, setVisuals] = useState<'pictures' | 'slides'>('pictures');
  const [format, setFormat] = useState<'lesson' | 'course'>('lesson');
  const [moduleCount, setModuleCount] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState<Lesson | null>(null);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const pollRef = useRef<number>(0);
  const coursePollRef = useRef<number>(0);

  useEffect(() => {
    getLessonOptions().then(setOptions).catch(() => {});
  }, []);

  const refreshList = useCallback(async () => {
    if (user) {
      try {
        const [l, c] = await Promise.all([listLessons(), listCourses().catch(() => [])]);
        setLessons(l);
        setCourses(c);
      } catch {
        /* list is optional */
      }
    } else {
      setLessons(loadRecent());
      setCourses(loadRecentCourses());
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

  // Poll a course until every module is made
  const watchCourse = useCallback((course: Course) => {
    window.clearTimeout(coursePollRef.current);
    setActiveCourse(course);
    if (!user) rememberCourse(course);
    if (course.status === 'done' || course.status === 'failed') {
      refreshList();
      return;
    }
    coursePollRef.current = window.setTimeout(async () => {
      try {
        watchCourse(await getCourse(course.id));
      } catch (err) {
        setActiveCourse({ ...course, status: 'failed', error: errorMessage(err) });
      }
    }, 3000);
  }, [user, refreshList]);

  useEffect(() => () => window.clearTimeout(coursePollRef.current), []);

  const openCourse = async (id: string) => {
    setError(null);
    try {
      watchCourse(await getCourse(id));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const removeCourse = async (item: CourseSummary) => {
    if (!window.confirm(`Delete the course “${item.title}” and all its modules?`)) return;
    try {
      if (user) await deleteCourse(item.id);
      else localStorage.setItem(RECENT_COURSES_KEY, JSON.stringify(loadRecentCourses().filter((c) => c.id !== item.id)));
      refreshList();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

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
      const common = {
        text: source === 'text' ? text : source === 'file' ? upload?.text.slice(0, MAX_TEXT) : undefined,
        video: source === 'video' && currentVideo ? currentVideo : undefined,
        audience,
        language,
        voice: voice || undefined,
        visuals: options && !options.pictures ? 'slides' as const : visuals,
      };
      if (format === 'course') watchCourse(await createCourse({ ...common, modules: moduleCount }));
      else watch(await createLesson({ ...common, length }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const material = source === 'file' ? upload?.text || '' : text;
  const canSubmit = !submitting && (source === 'video' ? Boolean(currentVideo) : material.trim().length >= 15);

  // ---------------------------------------------------------------- active course
  if (activeCourse) {
    return (
      <div className="max-w-6xl mx-auto">
        <button onClick={() => { window.clearTimeout(coursePollRef.current); setActiveCourse(null); refreshList(); }} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-200 mb-4">
          <ArrowLeft className="w-4 h-4" /> All video lessons
        </button>
        <CoursePlayer course={activeCourse} />
      </div>
    );
  }

  // ---------------------------------------------------------------- active lesson
  if (active) {
    return (
      <div className="max-w-5xl mx-auto">
        <button onClick={() => { window.clearTimeout(pollRef.current); setActive(null); refreshList(); }} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-200 mb-4">
          <ArrowLeft className="w-4 h-4" /> All video lessons
        </button>

        {active.status === 'done' ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="mb-4">
              <div className="flex flex-wrap items-start gap-3">
                <h1 className="font-semiwide text-2xl md:text-3xl font-extrabold tracking-tight text-ink-50 mr-auto">{active.title}</h1>
                {active.isOwner && !active.courseId && (
                  <ShareButton
                    kind="lesson" id={active.id} title={active.title}
                    isPublic={Boolean(active.isPublic)} shareSlug={active.shareSlug || null}
                    onChange={(st) => setActive((a) => (a ? { ...a, ...st } : a))}
                  />
                )}
              </div>
              <p className="text-sm text-ink-500 mt-1">
                {AUDIENCES.find((a) => a.value === active.audience)?.label} · {languageLabel(active.language)}
                {active.sourceVideo && <> · from “{active.sourceVideo.title}”</>}
              </p>
              {active.planning?.method === 'textrank' && (
                <p className="text-xs text-ink-500 mt-1" title="TextRank picked the key sentences so the lesson covers the whole material">
                  Long material: {active.planning.kept} key sentences of {active.planning.sentences} were used
                  ({Math.round(active.planning.inputChars / 1000)}k → {Math.round((active.planning.outputChars || 0) / 1000)}k characters).
                </p>
              )}
            </div>
            <LessonPlayer key={active.id} lesson={active} />
          </motion.div>
        ) : active.status === 'failed' ? (
          <div className="max-w-lg mx-auto py-16 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-red-300">{active.error || 'Something went wrong while creating the lesson.'}</p>
            <button onClick={() => setActive(null)} className="px-4 py-2 rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-200 text-sm">Try again</button>
          </div>
        ) : (
          <LessonProgress lesson={active} />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- create form
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Clapperboard className="w-7 h-7 text-turmeric-400" />
        <h1 className="font-semiwide text-3xl font-extrabold tracking-tight text-ink-50">Create a video lesson</h1>
      </div>
      <p className="text-ink-400 mb-8">Turn any topic, notes, PDF or Word chapter, or YouTube video into a narrated, animated lesson — in {LANGUAGES.length} languages, for kids, students or teachers. Free.</p>

      <div className="bg-ink-900/50 border border-ink-800/50 rounded-2xl p-5 md:p-6 space-y-6">
        {/* source */}
        <div>
          <div className="flex flex-wrap gap-2 mb-3" role="tablist">
            <button
              role="tab" aria-selected={source === 'text'} onClick={() => setSource('text')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${source === 'text' ? 'bg-turmeric-400 text-ink-950' : 'bg-ink-800/60 text-ink-300 hover:bg-ink-700/60'}`}
            >
              <PenLine className="w-4 h-4" /> <span>Topic<span className="hidden sm:inline"> or text</span></span>
            </button>
            <button
              role="tab" aria-selected={source === 'file'} onClick={() => setSource('file')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${source === 'file' ? 'bg-turmeric-400 text-ink-950' : 'bg-ink-800/60 text-ink-300 hover:bg-ink-700/60'}`}
            >
              <FileUp className="w-4 h-4" /> <span><span className="sm:hidden">File</span><span className="hidden sm:inline">PDF or Word file</span></span>
            </button>
            <button
              role="tab" aria-selected={source === 'video'} onClick={() => setSource('video')} disabled={!currentVideo}
              title={currentVideo ? undefined : 'Summarize a YouTube video first'}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${source === 'video' ? 'bg-turmeric-400 text-ink-950' : 'bg-ink-800/60 text-ink-300 hover:bg-ink-700/60'}`}
            >
              <Youtube className="w-4 h-4" /> <span><span className="hidden sm:inline">From a </span>YouTube<span className="hidden sm:inline"> video</span></span>
            </button>
          </div>

          {source === 'text' ? (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                maxLength={MAX_TEXT}
                placeholder="Type a topic (e.g. “How do volcanoes erupt?”) or paste your notes, a textbook paragraph, or an article…"
                className="w-full p-4 bg-ink-950/60 border border-ink-700/50 rounded-xl text-ink-200 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-turmeric-500 resize-y"
                aria-label="Topic or text for the lesson"
              />
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-xs text-ink-500">Try:</span>
                {EXAMPLES.map((ex) => (
                  <button key={ex} onClick={() => setText(ex)} className="px-2.5 py-1 text-xs rounded-full border border-ink-700 text-ink-400 hover:text-ink-200 hover:border-ink-500">
                    {ex}
                  </button>
                ))}
                <span className="ml-auto text-xs text-ink-600">{text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}</span>
              </div>
            </>
          ) : source === 'file' ? (
            <FileSource file={upload} onChange={setUpload} maxChars={MAX_TEXT} />
          ) : currentVideo ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-950/60 border border-ink-700/50">
              <img src={currentVideo.metadata?.thumbnail || `https://i.ytimg.com/vi/${currentVideo.videoId}/mqdefault.jpg`} alt="" className="w-28 rounded-lg" />
              <div className="min-w-0">
                <p className="text-sm text-ink-200 font-medium line-clamp-2">{currentVideo.title}</p>
                <p className="text-xs text-ink-500 mt-0.5">The lesson will be based on this video’s transcript</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* format */}
        <div>
          <p className="text-xs font-semibold text-ink-400 mb-2">What should it make?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl" role="radiogroup" aria-label="Format">
            {[
              { value: 'lesson' as const, icon: Film, label: 'One video lesson', hint: 'One narrated lesson, about 1 to 3 minutes' },
              { value: 'course' as const, icon: ListTree, label: 'A course with modules', hint: 'Split into 3 to 5 short lessons that build on each other' },
            ].map((f) => (
              <button
                key={f.value} role="radio" aria-checked={format === f.value} onClick={() => setFormat(f.value)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left ${format === f.value ? 'border-turmeric-500/60 bg-turmeric-500/10' : 'border-ink-800 bg-ink-950/40 hover:border-ink-700'}`}
              >
                <f.icon className="w-5 h-5 text-turmeric-300 mt-0.5 shrink-0" />
                <span>
                  <span className="block text-sm text-ink-200 font-medium">{f.label}</span>
                  <span className="block text-[11px] text-ink-500 mt-0.5">{f.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {format === 'lesson' && source !== 'video' && material.length > LONG_FOR_ONE_LESSON && (
          <p className="-mt-3 text-sm text-ink-300">
            That's a lot of material for one short lesson. The most important parts will be picked out, but{' '}
            <button type="button" onClick={() => setFormat('course')} className="text-turmeric-300 hover:text-turmeric-200 underline underline-offset-2">
              a course with modules
            </button>{' '}
            would cover more of it.
          </p>
        )}

        {/* options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-semibold text-ink-400 mb-2">Who is it for?</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Audience">
              {AUDIENCES.map((a) => (
                <button
                  key={a.value} role="radio" aria-checked={audience === a.value} onClick={() => setAudience(a.value)}
                  className={`p-2.5 rounded-xl border text-left ${audience === a.value ? 'border-turmeric-500/60 bg-turmeric-500/10' : 'border-ink-800 bg-ink-950/40 hover:border-ink-700'}`}
                >
                  <p className="text-sm text-ink-200 font-medium">{a.label}</p>
                  <p className="text-[11px] text-ink-500 mt-0.5 leading-tight">{a.hint}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-ink-400 mb-2">Language</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-3 py-2.5 bg-ink-950/60 border border-ink-700/50 rounded-xl text-sm text-ink-200 focus:outline-none focus:ring-2 focus:ring-turmeric-500">
                {LANGUAGES.map((l) => <option key={l.code} value={l.code} className="bg-ink-900">{l.native}</option>)}
              </select>
            </label>
            {format === 'course' ? (
              <label className="block">
                <span className="block text-xs font-semibold text-ink-400 mb-2">Modules</span>
                <select value={moduleCount} onChange={(e) => setModuleCount(Number(e.target.value))} className="w-full px-3 py-2.5 bg-ink-950/60 border border-ink-700/50 rounded-xl text-sm text-ink-200 focus:outline-none focus:ring-2 focus:ring-turmeric-500">
                  {[3, 4, 5].map((n) => <option key={n} value={n} className="bg-ink-900">{n} modules (~{n} min)</option>)}
                </select>
              </label>
            ) : (
              <label className="block">
                <span className="block text-xs font-semibold text-ink-400 mb-2">Length</span>
                <select value={length} onChange={(e) => setLength(e.target.value as 'short' | 'standard')} className="w-full px-3 py-2.5 bg-ink-950/60 border border-ink-700/50 rounded-xl text-sm text-ink-200 focus:outline-none focus:ring-2 focus:ring-turmeric-500">
                  <option value="short" className="bg-ink-900">Short (~1 min)</option>
                  <option value="standard" className="bg-ink-900">Standard (~2–3 min)</option>
                </select>
              </label>
            )}
            <label className="block col-span-2">
              <span className="block text-xs font-semibold text-ink-400 mb-2">Narrator voice</span>
              <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full px-3 py-2.5 bg-ink-950/60 border border-ink-700/50 rounded-xl text-sm text-ink-200 focus:outline-none focus:ring-2 focus:ring-turmeric-500">
                <option value="" className="bg-ink-900">Automatic (best for the audience)</option>
                {options && Object.entries(options.voices).map(([name, label]) => (
                  <option key={name} value={name} className="bg-ink-900">{name} — {label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-ink-400 mb-2">Visual style</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl" role="radiogroup" aria-label="Visual style">
            {[
              { value: 'pictures' as const, icon: ImageIcon, label: '3D AI pictures', hint: 'A 3D educational render in every scene' },
              { value: 'slides' as const, icon: LayoutTemplate, label: 'Simple slides', hint: 'Animated text slides, fastest' },
            ].map((v) => {
              const disabled = v.value === 'pictures' && options !== null && !options.pictures;
              const selected = (disabled ? 'slides' : visuals) === v.value;
              return (
                <button
                  key={v.value} role="radio" aria-checked={selected} disabled={disabled} onClick={() => setVisuals(v.value)}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left disabled:opacity-40 ${selected ? 'border-turmeric-500/60 bg-turmeric-500/10' : 'border-ink-800 bg-ink-950/40 hover:border-ink-700'}`}
                >
                  <v.icon className="w-5 h-5 text-turmeric-300 mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-sm text-ink-200 font-medium">{v.label}</span>
                    <span className="block text-[11px] text-ink-500 mt-0.5">{disabled ? 'Not available on this server' : v.hint}</span>
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
            className="flex items-center gap-2 px-6 py-3 rounded-xl disabled:cursor-not-allowed disabled:bg-ink-800 disabled:text-ink-500 font-semibold bg-turmeric-400 text-ink-950 hover:bg-turmeric-300"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            {format === 'course' ? `Create a ${moduleCount}-module course` : 'Create video lesson'}
          </button>
          <p className="text-xs text-ink-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Free to make. Gemini writes and narrates the script, {options?.pictureProvider === 'cloudflare' ? 'Cloudflare FLUX' : 'Pollinations FLUX'} draws the pictures, and the quiz is made only when you ask.
          </p>
        </div>
      </div>

      {/* my courses */}
      {courses.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-ink-200 mb-4">{user ? 'Your courses' : 'Recent courses on this browser'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((item) => (
              <div key={item.id} className="group flex items-center gap-3 p-4 rounded-xl bg-ink-900/50 border border-ink-800/60 hover:border-turmeric-500/40 transition-colors">
                <button onClick={() => openCourse(item.id)} className="flex-1 flex items-center gap-3 min-w-0 text-left">
                  <ListTree className="w-7 h-7 text-turmeric-300 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink-200 truncate">{item.title}</span>
                    <span className="block text-xs text-ink-500 mt-0.5">
                      {item.status === 'failed' ? 'Failed' : item.status === 'done' ? `${item.moduleCount} modules, ${languageLabel(item.language)}` : 'Being made…'}
                    </span>
                  </span>
                </button>
                <button onClick={() => removeCourse(item)} className="p-2 rounded-lg text-ink-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Delete ${item.title}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* my lessons */}
      {lessons.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-ink-200 mb-4">{user ? 'Your video lessons' : 'Recent lessons on this browser'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lessons.map((item) => (
              <div key={item.id} className="group flex items-center gap-3 p-4 rounded-xl bg-ink-900/50 border border-ink-800/60 hover:border-turmeric-500/40 transition-colors">
                <button onClick={() => open(item.id)} className="flex-1 flex items-center gap-3 min-w-0 text-left">
                  <span className="text-3xl">{item.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink-200 truncate">{item.title}</span>
                    <span className="block text-xs text-ink-500 mt-0.5">
                      {item.status === 'done' ? `${AUDIENCES.find((a) => a.value === item.audience)?.label} · ${languageLabel(item.language)}`
                        : item.status === 'failed' ? 'Failed' : `Creating… ${item.progress}%`}
                    </span>
                  </span>
                </button>
                <button onClick={() => remove(item)} className="p-2 rounded-lg text-ink-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Delete ${item.title}`}>
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
