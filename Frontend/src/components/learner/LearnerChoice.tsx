import { GraduationCap, Presentation } from 'lucide-react';
import { Learner, LearnerLevel, LearnerRole } from '../../types';

export const LEVEL_INFO: { value: LearnerLevel; label: string; hint: string }[] = [
  { value: 'beginner', label: 'Beginner', hint: 'New to most topics: plain words, analogies, step by step' },
  { value: 'intermediate', label: 'Intermediate', hint: 'Know the basics: clear explanations with examples' },
  { value: 'advanced', label: 'Advanced', hint: 'Comfortable: concise, precise, and deeper' },
];

export const learnerLabel = (l: Learner) =>
  l.role === 'teacher' ? 'Teacher' : `Student, ${LEVEL_INFO.find((x) => x.value === l.level)?.label.toLowerCase()}`;

const ROLE_INFO: { value: LearnerRole; label: string; hint: string; Icon: typeof GraduationCap }[] = [
  { value: 'student', label: 'I\'m a student', hint: 'Summaries, tutor answers and lessons at your level', Icon: GraduationCap },
  { value: 'teacher', label: 'I\'m a teacher', hint: 'Teaching guides, class videos and printable lesson plans', Icon: Presentation },
];

/** Role cards and, for students, the level: used at sign-up and in settings */
export default function LearnerChoice({ value, onChange, compact = false }: { value: Learner; onChange: (l: Learner) => void; compact?: boolean }) {
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="I am a" className="grid grid-cols-2 gap-2">
        {ROLE_INFO.map(({ value: role, label, hint, Icon }) => (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={value.role === role}
            onClick={() => onChange({ ...value, role })}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${value.role === role ? 'border-neon-300 bg-neon-400/15' : 'border-ink-700 hover:border-ink-500'}`}
          >
            <Icon className="h-5 w-5 text-neon-300" />
            <span className="text-sm font-semibold text-ink-50">{label}</span>
            {!compact && <span className="text-xs text-ink-400">{hint}</span>}
          </button>
        ))}
      </div>
      {value.role === 'student' && (
        <div>
          <p className="mb-2 text-xs font-semibold text-ink-300">How well do you usually know a new topic?</p>
          <div role="radiogroup" aria-label="Your level" className="grid gap-2">
            {LEVEL_INFO.map((l) => (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={value.level === l.value}
                onClick={() => onChange({ ...value, level: l.value })}
                className={`flex items-baseline gap-3 rounded-xl border px-3 py-2.5 text-left transition ${value.level === l.value ? 'border-neon-300 bg-neon-400/15' : 'border-ink-700 hover:border-ink-500'}`}
              >
                <span className="w-24 shrink-0 text-sm font-semibold text-ink-50">{l.label}</span>
                <span className="text-xs text-ink-400">{l.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
