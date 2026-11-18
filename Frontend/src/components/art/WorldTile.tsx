import { memo } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface WorldTheme {
  /** top and glow colours */
  from: string;
  to: string;
  icon: LucideIcon;
  seed: number;
}

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/**
 * An isometric floating island (a "world") drawn in SVG, with crystals and a glowing
 * subject icon above it. Each subject gets its own colours and layout from a seed.
 */
function WorldTile({ theme, className = '', iconSize = 56 }: { theme: WorldTheme; className?: string; iconSize?: number }) {
  const rand = rng(theme.seed);
  const crystals = Array.from({ length: 7 }, () => ({
    x: 120 + rand() * 160,
    y: 150 + rand() * 50,
    h: 18 + rand() * 34,
    w: 8 + rand() * 10,
  })).sort((a, b) => a.y - b.y);
  const stars = Array.from({ length: 26 }, () => ({ x: rand() * 400, y: rand() * 300, r: rand() * 1.3 + 0.3 }));
  const id = `w${theme.seed}`;
  const Icon = theme.icon;

  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden="true">
      <svg viewBox="0 0 400 300" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`${id}-bg`} cx="50%" cy="45%" r="70%">
            <stop offset="0" stopColor={theme.to} stopOpacity="0.45" />
            <stop offset="0.6" stopColor="#0E0D12" />
            <stop offset="1" stopColor="#050506" />
          </radialGradient>
          <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={theme.from} />
            <stop offset="1" stopColor={theme.to} />
          </linearGradient>
          <linearGradient id={`${id}-side`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2D2150" />
            <stop offset="1" stopColor="#050506" />
          </linearGradient>
        </defs>
        <rect width="400" height="300" fill={`url(#${id}-bg)`} />
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity="0.6" />)}
        {/* rays */}
        {Array.from({ length: 18 }, (_, i) => (
          <line key={i} x1="200" y1="170" x2={200 + Math.cos((i / 18) * Math.PI * 2) * 260} y2={170 + Math.sin((i / 18) * Math.PI * 2) * 260} stroke={theme.to} strokeOpacity="0.08" strokeWidth="2" />
        ))}
        {/* island: sides then top */}
        <path d="M80 175 L200 235 L200 275 L80 215 Z" fill={`url(#${id}-side)`} />
        <path d="M320 175 L200 235 L200 275 L320 215 Z" fill="#1B1238" />
        <path d="M80 175 L200 115 L320 175 L200 235 Z" fill={`url(#${id}-top)`} opacity="0.9" />
        <path d="M80 175 L200 115 L320 175 L200 235 Z" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" />
        {/* drips */}
        {[110, 150, 245, 290].map((x, i) => <rect key={x} x={x} y={i < 2 ? 190 + (x - 80) / 2 : 190 + (320 - x) / 2} width="5" height={14 + i * 6} rx="2.5" fill={theme.from} opacity="0.7" />)}
        {/* crystals */}
        {crystals.map((c, i) => (
          <g key={i}>
            <path d={`M${c.x} ${c.y} L${c.x + c.w / 2} ${c.y - c.h} L${c.x + c.w} ${c.y} Z`} fill={i % 2 ? theme.from : '#F2F0F6'} opacity={i % 2 ? 0.95 : 0.75} />
            <path d={`M${c.x + c.w / 2} ${c.y - c.h} L${c.x + c.w} ${c.y} L${c.x + c.w / 2} ${c.y + 3} Z`} fill="#050506" opacity="0.35" />
          </g>
        ))}
        <ellipse cx="200" cy="96" rx="58" ry="58" fill={theme.to} opacity="0.25" />
      </svg>
      <div className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full p-4" style={{ background: `radial-gradient(circle, ${theme.to}55, transparent 70%)` }}>
        <Icon style={{ width: iconSize, height: iconSize, color: '#F2F0F6', filter: `drop-shadow(0 0 14px ${theme.to})` }} strokeWidth={1.6} />
      </div>
    </div>
  );
}

export default memo(WorldTile);
