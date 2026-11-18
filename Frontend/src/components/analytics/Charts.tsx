import { useEffect, useRef, useState, PointerEvent as ReactPointerEvent } from 'react';
import { QuizAttempt } from '../../types';
import { DifficultyStat } from '../../lib/analytics';

/**
 * Small hand-built SVG charts (no chart library) following the app's dataviz rules:
 * one validated series hue, 2px lines, >=8px markers with a 2px surface ring,
 * bars <= 24px with a 4px rounded data-end and a square baseline, recessive grid,
 * text in text colours (never the series colour), and a hover tooltip on every mark.
 */

const VIZ = {
  surface: '#1F1C3B', // ink-900, the panel colour
  series: '#30A893', // lagoon-500, validated: dark band, chroma, >= 3:1 on the surface
  grid: 'rgba(169,163,194,0.14)',
  axis: 'rgba(169,163,194,0.35)',
  textPrimary: '#EEEAF6',
  textSecondary: '#A9A3C2',
  textMuted: '#8C86AE',
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

interface TooltipState { x: number; y: number; lines: { strong: string; text: string }[] }

function Tooltip({ tip, width }: { tip: TooltipState | null; width: number }) {
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x, 90), width - 90);
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full px-3 py-2 rounded-lg bg-ink-950/95 border border-ink-700 shadow-xl text-xs whitespace-nowrap"
      style={{ left, top: tip.y - 10 }}
    >
      {tip.lines.map((l, i) => (
        <div key={i} className={i ? 'mt-0.5 text-ink-400' : 'text-ink-200'}>
          <span className="font-semibold text-ink-100">{l.strong}</span>{l.text ? ` ${l.text}` : ''}
        </div>
      ))}
    </div>
  );
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Path for a bar with a 4px rounded data-end and a square baseline */
function barPath(x: number, y: number, w: number, h: number, dir: 'up' | 'right', r = 4) {
  const rr = Math.min(r, dir === 'up' ? w / 2 : h / 2, dir === 'up' ? h : w);
  if (dir === 'up') {
    return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
  }
  return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`;
}

// ------------------------------------------------------------------ score trend (line)

export function ScoreTrendChart({ attempts }: { attempts: QuizAttempt[] }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 240;
  const pad = { top: 16, right: 16, bottom: 30, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const n = attempts.length;
  const x = (i: number) => pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (pct: number) => pad.top + innerH - (pct / 100) * innerH;

  const path = attempts.map((a, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(a.scorePct).toFixed(1)}`).join(' ');
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 90))));

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!n) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round(((px - pad.left) / innerW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const h = hover !== null ? attempts[hover] : null;

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Score trend over your last ${n} quizzes`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        className="block touch-none"
      >
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={VIZ.grid} strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={VIZ.textMuted}>{t}%</text>
          </g>
        ))}
        {attempts.map((a, i) => ((i % labelEvery === 0 && (i === 0 || n - 1 - i >= labelEvery / 2)) || i === n - 1) && (
          <text
            key={a.id}
            x={x(i)}
            y={height - 8}
            textAnchor={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'}
            fontSize={11}
            fill={VIZ.textMuted}
          >
            {fmtDate(a.createdAt)}
          </text>
        ))}

        {h && hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke={VIZ.axis} strokeWidth={1} />
        )}
        <path d={path} fill="none" stroke={VIZ.series} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {attempts.map((a, i) => (
          <circle
            key={a.id}
            cx={x(i)}
            cy={y(a.scorePct)}
            r={hover === i ? 6 : 4}
            fill={VIZ.series}
            stroke={VIZ.surface}
            strokeWidth={2}
          />
        ))}
        {/* direct label on the latest point only */}
        {n > 0 && hover === null && (
          <text x={x(n - 1)} y={y(attempts[n - 1].scorePct) - 12} textAnchor={n > 1 ? 'end' : 'middle'} fontSize={12} fontWeight={600} fill={VIZ.textPrimary}>
            {attempts[n - 1].scorePct}%
          </text>
        )}
      </svg>
      <Tooltip
        width={width}
        tip={h && hover !== null ? {
          x: x(hover),
          y: y(h.scorePct),
          lines: [
            { strong: `${h.scorePct}%`, text: `· grade ${h.grade} · ${h.correct}/${h.total} correct` },
            { strong: '', text: `${h.title.slice(0, 48)}${h.title.length > 48 ? '…' : ''}` },
            { strong: '', text: `${fmtDate(h.createdAt)} · ${h.source === 'lesson' ? (h.kind === 'test' ? 'Lesson test' : 'Lesson quiz') : 'Video quiz'}` },
          ],
        } : null}
      />
    </div>
  );
}

// ------------------------------------------------------------------ accuracy by difficulty (horizontal bars)

const DIFF_LABEL: Record<DifficultyStat['difficulty'], string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', unrated: 'Unrated' };

export function DifficultyBars({ stats }: { stats: DifficultyStat[] }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const rowH = 44;
  const barH = 16;
  const labelW = 76;
  const valueW = 48;
  const height = stats.length * rowH;
  const trackW = width - labelW - valueW;

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={height} role="img" aria-label="Accuracy by question difficulty" className="block">
        {stats.map((s, i) => {
          const yy = i * rowH + (rowH - barH) / 2;
          const w = Math.max(2, (s.pct / 100) * trackW);
          return (
            <g
              key={s.difficulty}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              tabIndex={0}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${DIFF_LABEL[s.difficulty]}: ${s.pct}% (${s.correct} of ${s.total})`}
            >
              <rect x={0} y={i * rowH} width={width} height={rowH} fill="transparent" />
              <text x={0} y={yy + barH / 2} dominantBaseline="middle" fontSize={13} fill={VIZ.textSecondary}>{DIFF_LABEL[s.difficulty]}</text>
              <rect x={labelW} y={yy} width={trackW} height={barH} rx={4} fill="rgba(148,163,184,0.08)" />
              <path d={barPath(labelW, yy, w, barH, 'right')} fill={VIZ.series} opacity={hover === null || hover === i ? 1 : 0.55} />
              <text x={width} y={yy + barH / 2} textAnchor="end" dominantBaseline="middle" fontSize={13} fontWeight={600} fill={VIZ.textPrimary}>{s.pct}%</text>
            </g>
          );
        })}
      </svg>
      <Tooltip
        width={width}
        tip={hover !== null ? {
          x: labelW + (stats[hover].pct / 100) * trackW / 2,
          y: hover * rowH + 10,
          lines: [{ strong: `${stats[hover].pct}%`, text: `· ${DIFF_LABEL[stats[hover].difficulty]} · ${stats[hover].correct} of ${stats[hover].total} correct` }],
        } : null}
      />
    </div>
  );
}

// ------------------------------------------------------------------ grade distribution (columns)

export function GradeColumns({ grades }: { grades: { grade: string; count: number }[] }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 200;
  const pad = { top: 22, bottom: 26 };
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...grades.map((g) => g.count));
  const slot = width / grades.length;
  const barW = Math.min(24, slot * 0.5);
  const total = grades.reduce((n, g) => n + g.count, 0);

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={height} role="img" aria-label="Number of quizzes per grade" className="block">
        <line x1={0} x2={width} y1={pad.top + innerH} y2={pad.top + innerH} stroke={VIZ.axis} strokeWidth={1} />
        {grades.map((g, i) => {
          const h = (g.count / max) * innerH;
          const cx = slot * i + slot / 2;
          return (
            <g
              key={g.grade}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              tabIndex={0}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`Grade ${g.grade}: ${g.count} quizzes`}
            >
              <rect x={slot * i} y={0} width={slot} height={height} fill="transparent" />
              {g.count > 0 && (
                <path d={barPath(cx - barW / 2, pad.top + innerH - h, barW, h, 'up')} fill={VIZ.series} opacity={hover === null || hover === i ? 1 : 0.55} />
              )}
              <text x={cx} y={pad.top + innerH - h - 8} textAnchor="middle" fontSize={12} fontWeight={600} fill={g.count ? VIZ.textPrimary : VIZ.textMuted}>{g.count}</text>
              <text x={cx} y={height - 8} textAnchor="middle" fontSize={13} fontWeight={600} fill={VIZ.textSecondary}>{g.grade}</text>
            </g>
          );
        })}
      </svg>
      <Tooltip
        width={width}
        tip={hover !== null ? {
          x: slot * hover + slot / 2,
          y: pad.top + innerH - (grades[hover].count / max) * innerH,
          lines: [{ strong: String(grades[hover].count), text: `quiz${grades[hover].count === 1 ? '' : 'zes'} graded ${grades[hover].grade}${total ? ` · ${Math.round((grades[hover].count / total) * 100)}%` : ''}` }],
        } : null}
      />
    </div>
  );
}
