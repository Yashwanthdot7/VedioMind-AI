import { useEffect, useRef, useState } from 'react';
import { Loader2, Users, LinkIcon } from 'lucide-react';
import { Course, Lesson } from '../../types';
import { getCourse, getLesson, resolveShare } from '../../services/apiService';
import { errorMessage } from '../../lib/errors';
import LessonPlayer from '../lessons/LessonPlayer';
import CoursePlayer from '../lessons/CoursePlayer';

/** What a student sees after opening a class link: the lesson or course, no account needed */
export default function SharedPage({ slug, onMakeOwn }: { slug: string; onMakeOwn: () => void }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);
  const poll = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const loadCourse = async (id: string) => {
      const c = await getCourse(id);
      if (cancelled) return;
      setCourse(c);
      // The teacher may have shared it while modules were still being made
      if (c.status !== 'done' && c.status !== 'failed') poll.current = window.setTimeout(() => loadCourse(id).catch(() => {}), 4000);
    };
    (async () => {
      try {
        const target = await resolveShare(slug);
        if (target.kind === 'course') await loadCourse(target.id);
        else {
          const l = await getLesson(target.id);
          if (!cancelled) setLesson(l);
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'This link could not be opened.'));
      }
    })();
    return () => { cancelled = true; window.clearTimeout(poll.current); };
  }, [slug]);

  return (
    <div className="max-w-6xl mx-auto">
      {!error && <div className="flex flex-wrap items-center gap-3 mb-6 p-3 rounded-xl border border-ink-800 text-sm text-ink-300">
        <Users className="w-4 h-4 text-aqua-400 shrink-0" />
        <span className="mr-auto">Shared with you by your teacher. You can watch and take the quiz without an account.</span>
        <button onClick={onMakeOwn} className="text-neon-300 hover:text-neon-200">Make your own lesson</button>
      </div>}

      {error ? (
        <div className="py-20 text-center space-y-3">
          <LinkIcon className="w-9 h-9 mx-auto text-ink-600" />
          <p className="text-ink-200">{error}</p>
          <p className="text-sm text-ink-500">Ask your teacher for a new link.</p>
          <button onClick={onMakeOwn} className="text-sm text-neon-300 hover:text-neon-200">Make your own lesson instead</button>
        </div>
      ) : course ? (
        <CoursePlayer course={course} />
      ) : lesson ? (
        lesson.status === 'done' ? (
          <>
            <h1 className="font-display text-4xl md:text-6xl text-white mb-4">{lesson.title}</h1>
            <LessonPlayer lesson={lesson} />
          </>
        ) : (
          <p className="py-20 text-center text-ink-400">This lesson is still being made. Try again in a minute.</p>
        )
      ) : (
        <div className="py-24 text-center"><Loader2 className="w-8 h-8 mx-auto text-neon-400 animate-spin" /></div>
      )}
    </div>
  );
}
