import { CSSProperties, memo } from 'react';
import { Play } from 'lucide-react';

/** Deterministic pseudo-random so the art is the same on every render */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const SHARDS = [
  { x: 8, y: 22, s: 54, r: -18, d: 0 },
  { x: 22, y: 70, s: 34, r: 24, d: 2 },
  { x: 47, y: 12, s: 26, r: 40, d: 4 },
  { x: 88, y: 18, s: 44, r: -32, d: 1 },
  { x: 93, y: 64, s: 62, r: 12, d: 3 },
  { x: 70, y: 86, s: 30, r: -8, d: 5 },
  { x: 36, y: 46, s: 18, r: 60, d: 2.5 },
];

/** Video frames drifting toward the portal: what goes in comes out as understanding */
const FRAMES = [
  { x: 34, y: 28, w: 120, r: -10, d: 0.5 },
  { x: 40, y: 64, w: 96, r: 8, d: 2.2 },
  { x: 82, y: 40, w: 84, r: 14, d: 3.6 },
];

interface PortalArtProps {
  /** 0-100: where the portal's centre sits horizontally */
  focusX?: number;
  dim?: boolean;
  className?: string;
}

/**
 * The hero art: a glowing portal with floating shards and video frames, drawn with CSS and SVG
 * (no images to download). Motion stops when the visitor prefers reduced motion.
 */
function PortalArt({ focusX = 66, dim = false, className = '' }: PortalArtProps) {
  const rand = rng(7);
  const stars = Array.from({ length: 90 }, () => ({ x: rand() * 100, y: rand() * 100, r: rand() * 1.4 + 0.3, o: rand() * 0.7 + 0.2 }));

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden bg-ink-950 ${className}`} aria-hidden="true">
      {/* nebula */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(60% 70% at ${focusX}% 45%, rgba(224,64,251,0.35), transparent 60%),
            radial-gradient(45% 55% at ${focusX - 30}% 80%, rgba(118,80,255,0.35), transparent 70%),
            radial-gradient(40% 40% at 10% 10%, rgba(62,189,212,0.18), transparent 70%)`,
        }}
      />
      {/* stars */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r / 10} fill="#fff" opacity={s.o} />)}
      </svg>
      {/* circuit arcs */}
      <svg className="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" fill="none">
        <path d="M-40 640 C 300 520, 520 760, 820 600 S 1300 420, 1680 520" stroke="url(#arc)" strokeWidth="3" />
        <path d="M-40 760 C 380 700, 640 860, 980 720 S 1400 640, 1680 700" stroke="url(#arc)" strokeWidth="1.5" opacity="0.6" />
        <path d="M120 -20 C 260 200, 160 360, 420 460" stroke="#7650FF" strokeWidth="2" opacity="0.5" />
        <path d="M1520 -20 C 1380 180, 1500 300, 1300 420" stroke="#E040FB" strokeWidth="2" opacity="0.5" />
        <defs>
          <linearGradient id="arc" x1="0" x2="1">
            <stop offset="0" stopColor="#7650FF" stopOpacity="0" />
            <stop offset="0.5" stopColor="#E040FB" />
            <stop offset="1" stopColor="#3EBDD4" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>

      {/* the portal */}
      <div
        className="absolute aspect-square w-[min(115vw,980px)] -translate-x-1/2 -translate-y-1/2 animate-portal-breathe"
        style={{ left: `${focusX}%`, top: '46%' }}
      >
        <div className="absolute inset-0 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(224,64,251,0.55) 0%, rgba(118,80,255,0.25) 45%, transparent 68%)' }} />
        <div
          className="absolute inset-[8%] rounded-full animate-portal-spin"
          style={{
            background: 'conic-gradient(from 0deg, #E040FB, #7650FF 18%, transparent 30%, #F29BFF 48%, #3EBDD4 60%, transparent 72%, #E040FB 88%, #E040FB)',
            WebkitMask: 'radial-gradient(circle, transparent 57%, #000 58.5%, #000 64%, transparent 65.5%)',
            mask: 'radial-gradient(circle, transparent 57%, #000 58.5%, #000 64%, transparent 65.5%)',
            filter: 'drop-shadow(0 0 18px rgba(224,64,251,0.9))',
          }}
        />
        <div
          className="absolute inset-[18%] rounded-full animate-portal-spin-rev opacity-80"
          style={{
            background: 'conic-gradient(from 90deg, transparent, #F1ECFF 8%, transparent 16%, #B3A1FF 40%, transparent 50%, #E040FB 75%, transparent 85%)',
            WebkitMask: 'radial-gradient(circle, transparent 66%, #000 67%, #000 68.5%, transparent 69.5%)',
            mask: 'radial-gradient(circle, transparent 66%, #000 67%, #000 68.5%, transparent 69.5%)',
          }}
        />
        <div className="absolute inset-[27%] rounded-full" style={{ background: 'radial-gradient(circle at 50% 45%, #1A0E33 0%, #0B0716 60%, #120826 100%)', boxShadow: 'inset 0 0 80px rgba(224,64,251,0.35), 0 0 60px rgba(118,80,255,0.4)' }} />
        <div className="absolute inset-[34%] rounded-full opacity-70" style={{ background: 'radial-gradient(circle at 60% 40%, rgba(242,155,255,0.25), transparent 55%)' }} />
      </div>

      {/* floating shards */}
      {SHARDS.map((s, i) => (
        <div
          key={i}
          className="absolute animate-drift"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s * 1.15, animationDelay: `${-s.d}s`, ['--r' as string]: `${s.r}deg` } as CSSProperties}
        >
          <div
            className="h-full w-full"
            style={{
              clipPath: 'polygon(50% 0, 100% 38%, 78% 100%, 18% 88%, 0 30%)',
              background: 'linear-gradient(160deg, #3A2470 0%, #1A0F33 55%, #E040FB 140%)',
              boxShadow: 'inset 0 0 12px rgba(242,155,255,0.6)',
            }}
          />
        </div>
      ))}

      {/* video frames */}
      {FRAMES.map((f, i) => (
        <div
          key={i}
          className="absolute hidden md:block animate-drift"
          style={{ left: `${f.x}%`, top: `${f.y}%`, width: f.w, animationDelay: `${-f.d}s`, ['--r' as string]: `${f.r}deg` } as CSSProperties}
        >
          <div className="aspect-video rounded-lg border border-white/20 bg-ink-900/70 p-2 backdrop-blur-sm" style={{ boxShadow: '0 0 24px rgba(224,64,251,0.35)' }}>
            <div className="flex h-full items-center justify-center rounded bg-gradient-to-br from-neon-700/60 to-plasma-600/40">
              <Play className="h-4 w-4 fill-white text-white" />
            </div>
          </div>
        </div>
      ))}

      {/* fade into the page */}
      <div className={`absolute inset-0 ${dim ? 'bg-ink-950/70' : ''}`} style={{ background: dim ? undefined : 'linear-gradient(180deg, rgba(11,7,22,0.15) 0%, transparent 30%, transparent 60%, #0B0716 100%)' }} />
    </div>
  );
}

export default memo(PortalArt);
