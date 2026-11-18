import { useState } from 'react';
import { ClipboardList, Loader2, Printer, Download, RefreshCw, Clock, PauseCircle } from 'lucide-react';
import { Lesson, TeacherPlan } from '../../types';
import { getTeacherPlan } from '../../services/apiService';
import { errorMessage } from '../../lib/errors';
import { downloadText, slugify } from '../../lib/download';

function toMarkdown(lesson: Lesson, p: TeacherPlan): string {
  const lines = [
    `# Lesson plan: ${lesson.title}`,
    `${p.durationMinutes} minutes`,
    '', '## Objectives', ...p.objectives.map((o) => `- ${o}`),
    ...(p.materials.length ? ['', '## Materials', ...p.materials.map((m) => `- ${m}`)] : []),
    '', '## Steps',
    ...p.steps.map((s, i) => `${i + 1}. **${s.title}** (${s.minutes} min)${s.scene ? ` — video scene ${s.scene}` : ''}\n   - Teacher: ${s.teacher}\n   - Students: ${s.students}`),
    '', '## Common misconceptions', ...p.misconceptions.map((m) => `- ${m.misconception}\n  - Fix: ${m.fix}`),
    '', `## Activity: ${p.activity.title}`, p.activity.instructions,
    '', '## Questions to ask', ...p.questions.map((q) => `- ${q}`),
    '', '## Exit ticket', ...p.exitTicket.map((q) => `- ${q}`),
    '', '## Differentiation', p.differentiation,
  ];
  return lines.join('\n');
}

function printPlan(lesson: Lesson, p: TeacherPlan) {
  const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  const list = (items: string[]) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lesson plan: ${esc(lesson.title)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:720px;margin:32px auto;color:#111}h1{font-size:26px;margin:0}h2{font-size:17px;margin:22px 0 6px;border-bottom:1px solid #ccc}
.step{margin:8px 0}.muted{color:#555}</style></head><body>
<h1>${esc(lesson.title)}</h1><p class="muted">Lesson plan, ${p.durationMinutes} minutes</p>
<h2>Objectives</h2>${list(p.objectives)}${p.materials.length ? `<h2>Materials</h2>${list(p.materials)}` : ''}
<h2>Steps</h2>${p.steps.map((s, i) => `<div class="step"><b>${i + 1}. ${esc(s.title)}</b> (${s.minutes} min)${s.scene ? ` <span class="muted">· video scene ${s.scene}</span>` : ''}<br>Teacher: ${esc(s.teacher)}<br>Students: ${esc(s.students)}</div>`).join('')}
<h2>Common misconceptions</h2><ul>${p.misconceptions.map((m) => `<li>${esc(m.misconception)}<br><span class="muted">Fix: ${esc(m.fix)}</span></li>`).join('')}</ul>
<h2>Activity: ${esc(p.activity.title)}</h2><p>${esc(p.activity.instructions)}</p>
<h2>Questions to ask</h2>${list(p.questions)}<h2>Exit ticket</h2>${list(p.exitTicket)}
<h2>Differentiation</h2><p>${esc(p.differentiation)}</p></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

/** The teacher's printable lesson plan: made when asked, then saved with the lesson */
export default function TeacherPlanPanel({ lesson }: { lesson: Lesson }) {
  const [plan, setPlan] = useState<TeacherPlan | null>(lesson.teacherPlan || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (refresh = false) => {
    setBusy(true);
    setError(null);
    try {
      setPlan(await getTeacherPlan(lesson.id, refresh));
    } catch (err) {
      setError(errorMessage(err, 'Could not write the lesson plan.'));
    } finally {
      setBusy(false);
    }
  };

  const isClass = lesson.teacherMode === 'class';
  return (
    <section className="mt-6 rounded-2xl border border-ink-800/60 bg-ink-900/50 p-5" aria-labelledby={`plan-${lesson.id}`}>
      <div className="flex flex-wrap items-center gap-3">
        <ClipboardList className="h-5 w-5 text-neon-300" />
        <div className="mr-auto">
          <h2 id={`plan-${lesson.id}`} className="text-lg font-semibold text-ink-100">{isClass ? 'Teacher notes and lesson plan' : 'Your lesson plan'}</h2>
          <p className="text-xs text-ink-500">{isClass ? 'When to pause the video, what to ask, and an activity for after.' : 'Follow it in class, with or without the video.'}</p>
        </div>
        {plan ? (
          <>
            <button onClick={() => printPlan(lesson, plan)} className="flex items-center gap-1.5 rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-100 hover:bg-ink-700"><Printer className="h-4 w-4" /> Print</button>
            <button onClick={() => downloadText(`${slugify(lesson.title)}-lesson-plan.md`, toMarkdown(lesson, plan), 'text/markdown')} className="flex items-center gap-1.5 rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-100 hover:bg-ink-700"><Download className="h-4 w-4" /> Markdown</button>
            <button onClick={() => load(true)} disabled={busy} className="rounded-lg p-2 text-ink-400 hover:text-white" aria-label="Write a new lesson plan"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></button>
          </>
        ) : (
          <button onClick={() => load()} disabled={busy} className="btn-neon px-4 py-2 text-sm">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? 'Writing… (about 10 seconds)' : 'Make the lesson plan'}
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-red-300" role="alert">{error}</p>}

      {plan && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-5 text-sm">
            <p className="flex items-center gap-2 text-ink-300"><Clock className="h-4 w-4" /> {plan.durationMinutes} minutes</p>
            <div>
              <h3 className="mb-1.5 font-semibold text-ink-100">Objectives</h3>
              <ul className="list-disc space-y-1 pl-5 text-ink-300">{plan.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
            </div>
            {plan.materials.length > 0 && (
              <div>
                <h3 className="mb-1.5 font-semibold text-ink-100">Materials</h3>
                <ul className="list-disc space-y-1 pl-5 text-ink-300">{plan.materials.map((o) => <li key={o}>{o}</li>)}</ul>
              </div>
            )}
            <div>
              <h3 className="mb-1.5 font-semibold text-ink-100">Common misconceptions</h3>
              <ul className="space-y-2">{plan.misconceptions.map((m) => (
                <li key={m.misconception} className="rounded-lg bg-ink-950/50 p-3">
                  <p className="text-ink-200">{m.misconception}</p>
                  <p className="mt-1 text-aqua-300">Fix: {m.fix}</p>
                </li>
              ))}</ul>
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold text-ink-100">Exit ticket</h3>
              <ul className="list-disc space-y-1 pl-5 text-ink-300">{plan.exitTicket.map((q) => <li key={q}>{q}</li>)}</ul>
            </div>
          </div>
          <div className="space-y-5 text-sm">
            <ol className="space-y-3">
              {plan.steps.map((s, i) => (
                <li key={`${i}-${s.title}`} className="rounded-xl border border-ink-800 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neon-400 text-xs font-bold text-white">{i + 1}</span>
                    <span className="font-semibold text-ink-100">{s.title}</span>
                    <span className="text-xs text-ink-500">{s.minutes} min</span>
                    {s.scene > 0 && <span className="ml-auto flex items-center gap-1 rounded-full bg-plasma-400/15 px-2 py-0.5 text-xs text-plasma-300"><PauseCircle className="h-3.5 w-3.5" /> Scene {s.scene}</span>}
                  </div>
                  <p className="mt-2 text-ink-200"><span className="text-ink-500">You: </span>{s.teacher}</p>
                  <p className="mt-1 text-ink-300"><span className="text-ink-500">Students: </span>{s.students}</p>
                </li>
              ))}
            </ol>
            <div className="rounded-xl bg-neon-400/10 p-4">
              <h3 className="font-semibold text-ink-100">Activity: {plan.activity.title}</h3>
              <p className="mt-1 text-ink-300">{plan.activity.instructions}</p>
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold text-ink-100">Questions to ask</h3>
              <ul className="list-disc space-y-1 pl-5 text-ink-300">{plan.questions.map((q) => <li key={q}>{q}</li>)}</ul>
            </div>
            {plan.differentiation && <p className="text-ink-400"><span className="font-semibold text-ink-200">Differentiation: </span>{plan.differentiation}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
