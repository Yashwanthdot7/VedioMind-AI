import { useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, NotebookPen, ListChecks, Layers, Network, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Learner, StudyDataMap, StudyLevel, StudyType, VideoData } from '../../types';
import { useLearner } from '../../context/LearnerContext';
import { getStudyMaterial } from '../../services/apiService';
import { errorMessage } from '../../lib/errors';
import { recordAttempt } from '../../lib/attempts';
import { navigate } from '../../lib/navigation';
import NotesView from './NotesView';
import QuizView from './QuizView';
import FlashcardsView from './FlashcardsView';
import MindMapView from './MindMapView';

interface StudyToolsProps {
  video: VideoData;
  onSeek?: (seconds: number) => void;
}

const TOOLS: { type: StudyType; label: string; icon: typeof NotebookPen; blurb: string; wait: string }[] = [
  { type: 'notes', label: 'Notes', icon: NotebookPen, blurb: 'Organised notes with key terms', wait: 'Writing your notes' },
  { type: 'quiz', label: 'Quiz', icon: ListChecks, blurb: '8 questions to test yourself', wait: 'Making your quiz' },
  { type: 'flashcards', label: 'Flashcards', icon: Layers, blurb: 'Flip cards to memorise facts', wait: 'Creating flashcards' },
  { type: 'mindmap', label: 'Mind map', icon: Network, blurb: 'See how the ideas connect', wait: 'Drawing the mind map' },
];

const LEVELS: { value: StudyLevel; label: string }[] = [
  { value: 'kids', label: 'Kids' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'student', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'teacher', label: 'Teacher' },
];

/** The learner's profile picks the starting level; a level chosen here wins for next time */
function profileLevel(l: Learner): StudyLevel {
  if (l.role === 'teacher') return 'teacher';
  return l.level === 'beginner' ? 'beginner' : l.level === 'advanced' ? 'advanced' : 'student';
}

type Entry<T extends StudyType = StudyType> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: StudyDataMap[T]; version: number };

const LEVEL_STORAGE_KEY = 'videomind.studyLevel';

function loadLevel(fallback: StudyLevel): StudyLevel {
  try {
    const saved = localStorage.getItem(LEVEL_STORAGE_KEY);
    if (LEVELS.some((l) => l.value === saved)) return saved as StudyLevel;
  } catch {
    /* storage unavailable */
  }
  return fallback;
}

export default function StudyTools({ video, onSeek }: StudyToolsProps) {
  const [active, setActive] = useState<StudyType | null>(null);
  const { learner } = useLearner();
  const [level, setLevel] = useState<StudyLevel>(() => loadLevel(profileLevel(learner)));
  // keyed by `${type}:${level}` so switching level keeps earlier results
  const [entries, setEntries] = useState<Record<string, Entry>>({});

  const load = async (type: StudyType, lvl: StudyLevel, refresh = false) => {
    const key = `${type}:${lvl}`;
    setEntries((prev) => ({ ...prev, [key]: { status: 'loading' } }));
    try {
      const result = await getStudyMaterial(video, type, lvl, refresh);
      setEntries((prev) => ({ ...prev, [key]: { status: 'ready', data: result.data, version: Date.now() } }));
    } catch (err) {
      setEntries((prev) => ({ ...prev, [key]: { status: 'error', message: errorMessage(err) } }));
    }
  };

  const open = (type: StudyType, lvl: StudyLevel = level) => {
    setActive(type);
    const existing = entries[`${type}:${lvl}`];
    if (!existing || existing.status === 'error') load(type, lvl);
  };

  const changeLevel = (lvl: StudyLevel) => {
    setLevel(lvl);
    try {
      localStorage.setItem(LEVEL_STORAGE_KEY, lvl);
    } catch {
      /* storage unavailable */
    }
    if (active) open(active, lvl);
  };

  const entry = active ? entries[`${active}:${level}`] : undefined;
  const tool = TOOLS.find((t) => t.type === active);

  return (
    <div className="bg-ink-900/50 border border-ink-800/50 rounded-2xl overflow-hidden backdrop-blur-sm">
      <div className="p-4 border-b border-ink-800/50 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 mr-auto">
          <GraduationCap className="w-5 h-5 text-neon-400" />
          <h2 className="text-lg font-semibold text-ink-200">Study tools</h2>
        </div>
        <div className="flex rounded-lg bg-ink-950/60 border border-ink-800 p-0.5" role="radiogroup" aria-label="Level">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              role="radio"
              aria-checked={level === l.value}
              onClick={() => changeLevel(l.value)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                level === l.value ? 'bg-neon-400 text-white' : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 sm:flex gap-1 p-2 border-b border-ink-800/50" role="tablist">
        {TOOLS.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            role="tab"
            aria-selected={active === type}
            onClick={() => open(type)}
            className={`flex flex-col items-center gap-1 py-2 sm:px-8 rounded-lg text-xs font-medium transition-colors ${
              active === type ? 'bg-neon-500/15 text-neon-200' : 'text-ink-400 hover:bg-ink-800/50 hover:text-ink-200'
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
      </div>

      <div className="p-5" role="tabpanel">
        {!active && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {TOOLS.map(({ type, label, icon: Icon, blurb }) => (
              <button
                key={type}
                onClick={() => open(type)}
                className="p-4 text-left rounded-xl bg-ink-950/40 border border-ink-800/60 hover:border-neon-500/40 hover:bg-neon-500/5 transition-colors"
              >
                <Icon className="w-5 h-5 text-neon-400 mb-2" />
                <p className="text-sm font-semibold text-ink-200">{label}</p>
                <p className="text-xs text-ink-500 mt-0.5">{blurb}</p>
              </button>
            ))}
          </div>
        )}

        {active && entry?.status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-ink-400">
            <Loader2 className="w-8 h-8 text-neon-400 animate-spin" />
            <p className="text-sm">{tool?.wait}…</p>
            <p className="text-xs text-ink-600">Usually takes 10–30 seconds</p>
          </div>
        )}

        {active && entry?.status === 'error' && (
          <div className="flex flex-col items-center text-center py-10 gap-3">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-300 max-w-sm">{entry.message}</p>
            <button onClick={() => load(active, level)} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-200">
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </div>
        )}

        {active && entry?.status === 'ready' && (
          <motion.div key={`${active}:${level}:${entry.version}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {active === 'notes' && <NotesView notes={entry.data as StudyDataMap['notes']} videoTitle={video.title} videoId={video.videoId} onSeek={onSeek} />}
            {active === 'quiz' && (
              <QuizView
                quiz={entry.data as StudyDataMap['quiz']}
                videoTitle={video.title}
                onSeek={onSeek}
                onOpenAnalytics={() => navigate('analytics')}
                onComplete={async (result) => (await recordAttempt({
                  source: 'study', kind: 'quiz', title: video.title, language: video.language, level,
                  analysisId: video.analysisId, videoId: video.videoId, ...result,
                })).where}
              />
            )}
            {active === 'flashcards' && <FlashcardsView deck={entry.data as StudyDataMap['flashcards']} videoTitle={video.title} onSeek={onSeek} />}
            {active === 'mindmap' && <MindMapView map={entry.data as StudyDataMap['mindmap']} videoTitle={video.title} onSeek={onSeek} />}

            <div className="mt-5 pt-4 border-t border-ink-800/50 flex justify-end">
              <button
                onClick={() => load(active, level, true)}
                className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-300"
                title="Ask the AI for a fresh version"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
