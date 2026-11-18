import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Circle, AlertCircle, ChevronRight, ListTree } from 'lucide-react';
import { Course, CourseModule, Lesson } from '../../types';
import { getLesson } from '../../services/apiService';
import { languageLabel } from '../../constants/languages';
import LessonPlayer from './LessonPlayer';
import LessonProgress from './LessonProgress';
import ShareButton from '../share/ShareButton';
import TeacherPlanPanel from './TeacherPlanPanel';

const AUDIENCE_LABEL = { kids: 'Kids', student: 'Students', teacher: 'Teachers' } as const;

function pickModule(course: Course, current: number | null): number {
  if (current !== null && course.modules[current]) return current;
  const playable = course.modules.findIndex((m) => m.status === 'done');
  if (playable >= 0) return playable;
  const making = course.modules.findIndex((m) => m.lessonId && m.status !== 'failed');
  return making >= 0 ? making : 0;
}

function ModuleState({ m }: { m: CourseModule }) {
  if (m.status === 'done') return <CheckCircle2 className="w-5 h-5 text-aqua-400" aria-label="Ready" />;
  if (m.status === 'failed') return <AlertCircle className="w-5 h-5 text-red-400" aria-label="Failed" />;
  if (m.status === 'waiting') return <Circle className="w-5 h-5 text-ink-600" aria-label="Waiting" />;
  return <Loader2 className="w-5 h-5 text-neon-400 animate-spin" aria-label="Being made" />;
}

/** A course: the module list on one side, the selected module's lesson on the other */
export default function CoursePlayer({ course }: { course: Course }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const index = course.modules.length ? pickModule(course, selected) : null;
  const current = index !== null ? course.modules[index] : null;

  // Load the selected module's lesson; refresh it while it is still being made
  const lessonId = current?.lessonId || null;
  const moduleStatus = current?.status;
  const moduleProgress = current?.progress;
  useEffect(() => {
    let cancelled = false;
    if (!lessonId) { setLesson(null); return; }
    getLesson(lessonId).then((l) => { if (!cancelled) setLesson(l); }).catch(() => {});
    return () => { cancelled = true; };
  }, [lessonId, moduleStatus, moduleProgress]);

  const ready = course.modules.filter((m) => m.status === 'done').length;
  const planning = course.status === 'queued' || course.status === 'outlining';

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-ink-500 flex items-center gap-1.5"><ListTree className="w-4 h-4" /> Course</p>
        <div className="flex flex-wrap items-start gap-3 mt-1">
          <h1 className="font-display text-4xl md:text-6xl text-white mr-auto">{course.title}</h1>
          {course.isOwner && course.status !== 'queued' && course.status !== 'outlining' && (
            <ShareButton kind="course" id={course.id} title={course.title} isPublic={Boolean(course.isPublic)} shareSlug={course.shareSlug || null} />
          )}
        </div>
        <p className="text-sm text-ink-500 mt-1">
          {AUDIENCE_LABEL[course.audience]}, {languageLabel(course.language)}.{' '}
          {planning ? 'Planning the modules…' : course.status === 'building'
            ? `${ready} of ${course.modules.length} modules ready. You can start watching while the rest are made.`
            : `${ready} of ${course.modules.length} modules.`}
        </p>
        {course.status !== 'done' && course.status !== 'failed' && (
          <div className="mt-3 h-1.5 max-w-md rounded-full bg-ink-800 overflow-hidden" role="progressbar" aria-valuenow={course.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
            <div className="h-full bg-neon-400 transition-[width] duration-700" style={{ width: `${course.progress}%` }} />
          </div>
        )}
        {course.error && course.status !== 'building' && <p className="mt-2 text-sm text-amber-300/90">{course.error}</p>}
      </div>

      {planning ? (
        <div className="py-16 text-center text-ink-400">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-neon-400 animate-spin" />
          Reading the material and splitting it into modules…
        </div>
      ) : course.status === 'failed' && !course.modules.length ? (
        <p className="py-16 text-center text-red-300">{course.error || 'The course could not be made.'}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-6 items-start">
          <ol className="space-y-2 lg:sticky lg:top-20" aria-label="Modules">
            {course.modules.map((m) => {
              const active = m.index === index;
              return (
                <li key={m.index}>
                  <button
                    onClick={() => {
                      setSelected(m.index);
                      // On phones the player is below the list: bring it into view
                      if (window.innerWidth < 1024) {
                        requestAnimationFrame(() => document.getElementById('course-module')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                      }
                    }}
                    aria-current={active ? 'step' : undefined}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                      active ? 'border-neon-400/60 bg-ink-900' : 'border-ink-800 hover:border-ink-600'
                    }`}
                  >
                    <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${active ? 'bg-neon-400 text-white' : 'bg-ink-800 text-ink-300'}`}>
                      {m.index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink-100">{m.title}</span>
                      <span className="block text-xs text-ink-500 mt-0.5 line-clamp-2">{m.goal}</span>
                      {m.status !== 'done' && m.status !== 'waiting' && m.status !== 'failed' && (
                        <span className="block text-xs text-neon-300 mt-1">Being made, {m.progress}%</span>
                      )}
                    </span>
                    <ModuleState m={m} />
                  </button>
                </li>
              );
            })}
          </ol>

          <section id="course-module" className="min-w-0 scroll-mt-20" aria-label={current ? `Module ${current.index + 1}: ${current.title}` : 'Module'}>
            {!current ? null : current.status === 'waiting' ? (
              <div className="p-8 rounded-panel border border-dashed border-ink-700 text-center">
                <p className="text-ink-200 font-medium">Module {current.index + 1} is next in line</p>
                <p className="text-sm text-ink-500 mt-1">Modules are made one after another. This one starts when the one before it is finished.</p>
                <ul className="mt-4 text-sm text-ink-400 space-y-1">{current.keyPoints.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
            ) : current.status === 'failed' ? (
              <div className="p-8 rounded-panel border border-red-500/30 text-center text-red-300">
                This module could not be made{lesson?.error ? `: ${lesson.error}` : '.'}
              </div>
            ) : !lesson || lesson.id !== current.lessonId ? (
              <div className="py-16 text-center"><Loader2 className="w-7 h-7 mx-auto text-neon-400 animate-spin" /></div>
            ) : lesson.status === 'done' ? (
              <>
                <LessonPlayer key={lesson.id} lesson={lesson} />
                {lesson.audience === 'teacher' && <TeacherPlanPanel key={`plan-${lesson.id}`} lesson={lesson} />}
                {course.modules[current.index + 1] && (
                  <button
                    onClick={() => { setSelected(current.index + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-400 hover:bg-neon-500 text-white font-semibold"
                  >
                    Next: {course.modules[current.index + 1].title} <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </>
            ) : (
              <LessonProgress lesson={lesson} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
