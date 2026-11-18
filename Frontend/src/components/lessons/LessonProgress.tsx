import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Image as ImageIcon, Mic, Video, CheckCircle2, Loader2, Circle } from 'lucide-react';
import { Lesson } from '../../types';
import { fetchLessonImageUrl } from '../../services/apiService';

type StepState = 'done' | 'active' | 'todo';

/**
 * Live view while a lesson is being made: the script appears first,
 * then each scene's picture pops in and its narration gets a tick.
 */
export default function LessonProgress({ lesson }: { lesson: Lesson }) {
  const n = lesson.scenes.length;
  const scripting = lesson.status === 'queued' || lesson.status === 'scripting';
  const wantsPictures = lesson.visuals !== 'slides';
  const pictured = lesson.scenes.filter((s) => s.imageStatus === 'done' || s.imageStatus === 'failed' || s.imageStatus === 'skipped').length;
  const voiced = lesson.voiceMode === 'browser' ? n : lesson.scenes.filter((s) => s.audio).length;

  const steps: { label: string; icon: typeof FileText; state: StepState; detail?: string }[] = [
    { label: 'Script', icon: FileText, state: scripting ? 'active' : 'done', detail: n ? `${n} scenes` : undefined },
    ...(wantsPictures ? [{
      label: 'Pictures', icon: ImageIcon,
      state: (scripting ? 'todo' : pictured >= n ? 'done' : 'active') as StepState,
      detail: n ? `${pictured}/${n}` : undefined,
    }] : []),
    {
      label: 'Audio', icon: Mic,
      state: scripting ? 'todo' : voiced >= n ? 'done' : 'active',
      detail: n ? `${voiced}/${n}` : undefined,
    },
    { label: 'Video', icon: Video, state: lesson.status === 'done' ? 'done' : 'todo' },
  ];

  // Load each picture once, as soon as it exists
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const requested = useRef(new Set<number>());
  const urls = useRef<string[]>([]);
  useEffect(() => {
    lesson.scenes.forEach((s, i) => {
      if (s.image && !requested.current.has(i)) {
        requested.current.add(i);
        fetchLessonImageUrl(lesson.id, i)
          .then((url) => { urls.current.push(url); setThumbs((prev) => ({ ...prev, [i]: url })); })
          .catch(() => {});
      }
    });
  }, [lesson.id, lesson.scenes]);
  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="p-6 rounded-2xl bg-ink-900/50 border border-ink-800/60">
        <div className="text-center mb-6">
          <Loader2 className="w-9 h-9 mx-auto text-neon-400 animate-spin mb-3" />
          <h2 className="text-xl font-bold text-ink-100">Generating your video lesson</h2>
          <p className="text-sm text-ink-400 mt-1">
            {scripting ? 'Writing the script…' : 'Content appears below as each part is ready'}
            {lesson.title && !scripting && lesson.title !== 'New lesson' ? <> · <span className="text-ink-300">{lesson.title}</span></> : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mb-4">
          {steps.map((step) => (
            <div
              key={step.label}
              className={`flex items-center gap-2 text-sm ${
                step.state === 'done' ? 'text-aqua-300' : step.state === 'active' ? 'text-neon-200' : 'text-ink-500'
              }`}
            >
              <step.icon className="w-4 h-4" />
              <span className="font-medium">{step.label}</span>
              {step.detail && <span className="text-xs tabular-nums opacity-80">{step.detail}</span>}
              {step.state === 'done' ? <CheckCircle2 className="w-4 h-4" />
                : step.state === 'active' ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Circle className="w-4 h-4" />}
            </div>
          ))}
        </div>
        <div className="h-2 bg-ink-800 rounded-full overflow-hidden">
          <div className="h-full transition-all duration-700 bg-neon-400 text-white" style={{ width: `${Math.max(4, lesson.progress)}%` }} />
        </div>
        <p className="text-center text-xs text-ink-500 mt-2">
          {lesson.progress}% · usually 1–3 minutes{wantsPictures ? ' (free pictures can take a little longer)' : ''}
        </p>
      </div>

      {/* scenes appear as soon as the script is written */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scripting && Array.from({ length: 6 }, (_, i) => (
          <div key={`sk-${i}`} className="rounded-xl overflow-hidden border border-ink-800/60 bg-ink-900/40 animate-pulse">
            <div className="aspect-video bg-ink-800/60" />
            <div className="p-3 space-y-2">
              <div className="h-3 w-2/3 bg-ink-800 rounded" />
              <div className="h-3 w-full bg-ink-800/70 rounded" />
            </div>
          </div>
        ))}
        <AnimatePresence>
          {lesson.scenes.map((scene, i) => {
            const thumb = thumbs[i];
            const pictureState = scene.imageStatus;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl overflow-hidden border border-ink-800/60 bg-ink-900/50"
              >
                <div className="relative aspect-video bg-ink-950 flex items-center justify-center">
                  {thumb ? (
                    <motion.img initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : pictureState === 'pending' ? (
                    <div className="absolute inset-0 animate-pulse flex items-center justify-center bg-ink-900">
                      <ImageIcon className="w-7 h-7 text-ink-600" />
                    </div>
                  ) : (
                    <span className="text-5xl">{scene.icon}</span>
                  )}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-[11px] text-white">Scene {i + 1}</span>
                  <span
                    className={`absolute top-2 right-2 p-1 rounded-md bg-black/60 ${scene.audio || lesson.voiceMode === 'browser' ? 'text-aqua-300' : 'text-ink-400'}`}
                    title={scene.audio ? 'Narration recorded' : 'Recording narration…'}
                  >
                    {scene.audio || lesson.voiceMode === 'browser' ? <Mic className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-ink-200 line-clamp-1">{scene.heading}</p>
                  <p className="text-xs text-ink-500 mt-1 line-clamp-2 leading-relaxed">{scene.narration}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
