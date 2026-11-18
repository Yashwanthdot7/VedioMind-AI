import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Trophy, Target, Flame, ListChecks, Clock, Trash2, Loader2, Info, Upload, BookOpenCheck, RotateCcw,
} from 'lucide-react';
import { QuizAttempt } from '../../types';
import { clearAttempts, deleteAttempt, importLocalAttempts, listAttempts, localAttemptCount } from '../../lib/attempts';
import { filterAttempts, RangeFilter, SourceFilter, summarise } from '../../lib/analytics';
import { gradeClass } from '../../lib/grades';
import { errorMessage } from '../../lib/errors';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../lib/navigation';
import { DifficultyBars, GradeColumns, ScoreTrendChart } from './Charts';
import ReviewSection from './ReviewSection';

const KIND_LABEL: Record<QuizAttempt['kind'], string> = { quiz: 'Video quiz', quick: 'Lesson quiz', test: 'Lesson test' };

function StatTile({ icon: Icon, label, value, sub }: { icon: typeof Trophy; label: string; value: string; sub?: string }) {
  return (
    <div className="p-4 rounded-2xl bg-ink-900/50 border border-ink-800/60">
      <div className="flex items-center gap-2 text-xs text-ink-400">
        <Icon className="w-4 h-4 text-turmeric-300" /> {label}
      </div>
      <p className="mt-2 text-3xl font-bold text-ink-100 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-ink-500 mt-1">{sub}</p>}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="p-5 rounded-2xl bg-ink-900/50 border border-ink-800/60">
      <h2 className="text-base font-semibold text-ink-100">{title}</h2>
      {subtitle && <p className="text-xs text-ink-500 mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="flex rounded-lg bg-ink-950/60 border border-ink-800 p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${value === o.value ? 'bg-turmeric-400 text-ink-950' : 'text-ink-400 hover:text-ink-200'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [where, setWhere] = useState<'account' | 'browser'>('browser');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [localCount, setLocalCount] = useState(0);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await listAttempts();
      setAttempts(res.attempts);
      setWhere(res.where);
      setLocalCount(res.where === 'account' ? localAttemptCount() : 0);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, user]);

  const filtered = useMemo(() => filterAttempts(attempts, range, source), [attempts, range, source]);
  const s = useMemo(() => summarise(filtered), [filtered]);

  const remove = async (a: QuizAttempt) => {
    try {
      await deleteAttempt(a.id);
      setAttempts((prev) => prev.filter((x) => x.id !== a.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const clearAll = async () => {
    if (!window.confirm('Delete your whole quiz history? This can’t be undone.')) return;
    try {
      await clearAttempts(where);
      setAttempts([]);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const importLocal = async () => {
    setImporting(true);
    try {
      await importLocalAttempts();
      await load();
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-turmeric-400 animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <BarChart3 className="w-7 h-7 text-turmeric-400" />
        <h1 className="font-semiwide text-3xl font-extrabold tracking-tight text-ink-50 mr-auto">Your progress</h1>
        {attempts.length > 0 && (
          <>
            <Segmented label="Time range" value={range} onChange={setRange} options={[
              { value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: 'all', label: 'All time' },
            ]} />
            <Segmented label="Quiz type" value={source} onChange={setSource} options={[
              { value: 'all', label: 'All' }, { value: 'study', label: 'Video quizzes' }, { value: 'lesson', label: 'Lesson quizzes' },
            ]} />
          </>
        )}
      </div>

      {where === 'browser' && (
        <p className="flex items-start gap-2 text-sm text-ink-400">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          Your history is saved on this browser. Sign in to keep it across devices.
        </p>
      )}
      {localCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-turmeric-500/10 border border-turmeric-500/30 text-sm text-turmeric-100">
          <Upload className="w-4 h-4" />
          {localCount} quiz{localCount === 1 ? '' : 'zes'} from before you signed in {localCount === 1 ? 'is' : 'are'} saved on this browser.
          <button onClick={importLocal} disabled={importing} className="ml-auto px-3 py-1.5 rounded-lg bg-turmeric-400 hover:bg-turmeric-300 text-ink-950 text-xs disabled:opacity-50">
            {importing ? 'Importing…' : 'Add to my account'}
          </button>
        </div>
      )}
      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>}

      <ReviewSection attempts={attempts} scope={user?.id || 'guest'} onAttemptSaved={() => load(true)} />

      {attempts.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-ink-800">
          <ListChecks className="w-10 h-10 mx-auto text-ink-600 mb-3" />
          <p className="text-ink-300 font-medium">No quizzes yet</p>
          <p className="text-sm text-ink-500 mt-1 max-w-md mx-auto">
            Take a quiz from a video’s study tools, or a Quick quiz / Full test after a video lesson. Your scores, grades and progress will appear here.
          </p>
          <div className="flex justify-center gap-3 mt-5">
            <button onClick={() => navigate('lessons')} className="px-4 py-2 rounded-lg bg-turmeric-400 hover:bg-turmeric-300 text-ink-950 text-sm">Create a video lesson</button>
            <button onClick={() => navigate('home')} className="px-4 py-2 rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-200 text-sm">Summarize a video</button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-16 text-ink-500">No quizzes match these filters.</p>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatTile icon={ListChecks} label="Quizzes" value={String(s.count)} sub={`${s.questions} questions`} />
            <StatTile icon={Target} label="Average" value={`${s.averagePct}%`} sub={`Accuracy ${s.accuracyPct}%`} />
            <StatTile icon={Trophy} label="Best" value={s.best ? `${s.best.scorePct}%` : '–'} sub={s.best ? `Grade ${s.best.grade}` : undefined} />
            <StatTile icon={Flame} label="Streak" value={`${s.streak} day${s.streak === 1 ? '' : 's'}`} sub={s.streak ? 'Keep it going!' : 'Take a quiz today'} />
            <StatTile icon={Clock} label="Time" value={`${s.minutes} min`} sub="spent on quizzes" />
          </motion.div>

          <Panel title="Score over time" subtitle={`Your last ${s.trend.length} quiz${s.trend.length === 1 ? '' : 'zes'} · hover a point for details`}>
            <ScoreTrendChart attempts={s.trend} />
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel title="Accuracy by difficulty" subtitle="Share of questions answered correctly">
              {s.byDifficulty.length ? <DifficultyBars stats={s.byDifficulty} /> : <p className="text-sm text-ink-500">No difficulty data yet.</p>}
            </Panel>
            <Panel title="Grades" subtitle="A+ ≥ 90% · A ≥ 80 · B ≥ 70 · C ≥ 60 · D below 60">
              <GradeColumns grades={s.grades} />
            </Panel>
          </div>

          {s.toReview.length > 0 && (
            <Panel title="Worth revisiting" subtitle="Your most recent quizzes scored below a B">
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {s.toReview.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-ink-950/40 border border-ink-800/60">
                    <RotateCcw className="w-4 h-4 text-amber-300 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-ink-200 truncate">{a.title}</span>
                      <span className="block text-xs text-ink-500">{KIND_LABEL[a.kind]} · {a.scorePct}%</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border text-xs font-bold ${gradeClass(a.grade)}`}>{a.grade}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="History" subtitle="Every quiz you’ve taken (also the table view of the charts above)">
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-500">
                    <th className="px-2 py-2 font-medium">Quiz</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium text-right">Score</th>
                    <th className="px-2 py-2 font-medium text-center">Grade</th>
                    <th className="px-2 py-2 font-medium text-right">Time</th>
                    <th className="px-2 py-2 font-medium text-right">Date</th>
                    <th className="px-2 py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="border-t border-ink-800/60 hover:bg-ink-800/20">
                      <td className="px-2 py-2.5 text-ink-200 max-w-xs">
                        <span className="flex items-center gap-2">
                          <BookOpenCheck className="w-4 h-4 text-ink-500 shrink-0" />
                          <span className="truncate">{a.title}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-ink-400 whitespace-nowrap">{KIND_LABEL[a.kind]}</td>
                      <td className="px-2 py-2.5 text-right text-ink-200 tabular-nums whitespace-nowrap">{a.correct}/{a.total} · {a.scorePct}%</td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={`inline-block min-w-[2.25rem] px-2 py-0.5 rounded-md border text-xs font-bold ${gradeClass(a.grade)}`}>{a.grade}</span>
                      </td>
                      <td className="px-2 py-2.5 text-right text-ink-400 tabular-nums whitespace-nowrap">
                        {a.durationSec ? `${Math.floor(a.durationSec / 60)}:${String(Math.round(a.durationSec % 60)).padStart(2, '0')}` : '–'}
                      </td>
                      <td className="px-2 py-2.5 text-right text-ink-400 whitespace-nowrap">{new Date(a.createdAt).toLocaleDateString()}</td>
                      <td className="px-2 py-2.5 text-right">
                        <button onClick={() => remove(a)} className="p-1.5 rounded-lg text-ink-600 hover:text-red-400 hover:bg-red-500/10" aria-label={`Delete ${a.title}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={clearAll} className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" /> Clear history
              </button>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
