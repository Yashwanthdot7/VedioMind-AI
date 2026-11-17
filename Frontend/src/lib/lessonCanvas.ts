import { LessonScene } from '../types';

/**
 * Draws one frame of a video lesson onto a 1280×720 canvas.
 * The same function powers the in-app player and the MP4 export,
 * so what you watch is exactly what you download.
 */

export const WIDTH = 1280;
export const HEIGHT = 720;

const FONT = '"Inter", "Noto Sans", "Nirmala UI", "Mangal", "Latha", "Tunga", system-ui, sans-serif';
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

const PALETTES = [
  { from: '#1e1b4b', to: '#312e81', accent: '#a5b4fc', glow: '#6366f1' },
  { from: '#0c4a6e', to: '#164e63', accent: '#67e8f9', glow: '#06b6d4' },
  { from: '#3b0764', to: '#581c87', accent: '#f0abfc', glow: '#c026d3' },
  { from: '#064e3b', to: '#065f46', accent: '#6ee7b7', glow: '#10b981' },
  { from: '#7c2d12', to: '#9a3412', accent: '#fdba74', glow: '#f97316' },
  { from: '#1e3a8a', to: '#1e40af', accent: '#93c5fd', glow: '#3b82f6' },
  { from: '#831843', to: '#9d174d', accent: '#f9a8d4', glow: '#ec4899' },
];

export interface FrameInfo {
  scene: LessonScene;
  sceneIndex: number;
  sceneCount: number;
  /** seconds into this scene */
  time: number;
  /** length of this scene in seconds */
  duration: number;
  lessonTitle: string;
  captions: boolean;
  /** AI picture for this scene (ImageBitmap / image), or null for the drawn slide */
  image?: CanvasImageSource & { width: number; height: number } | null;
}

/** Text area of a layout: full width, or the left part when a picture panel is shown */
interface Area {
  x: number;
  w: number;
  icon: boolean;
}

// ------------------------------------------------------------------ helpers

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const easeOut = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeBack = (x: number) => {
  const c = 1.70158;
  const t = clamp(x) - 1;
  return 1 + (c + 1) * t * t * t + c * t * t;
};
/** 0→1 animation that starts at `delay` seconds and lasts `length` seconds */
const appear = (time: number, delay: number, length = 0.6) => easeOut((time - delay) / length);

function font(size: number, weight = 600) {
  return `${weight} ${size}px ${FONT}`;
}

/** Word-wrap (falls back to per-character wrapping for scripts without spaces) */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 4): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  const pushWord = (word: string) => {
    if (ctx.measureText(word).width <= maxWidth) return [word];
    // very long word / no spaces (e.g. Japanese): break by characters
    const parts: string[] = [];
    let part = '';
    for (const ch of Array.from(word)) {
      if (ctx.measureText(part + ch).width > maxWidth && part) { parts.push(part); part = ch; } else part += ch;
    }
    if (part) parts.push(part);
    return parts;
  };
  for (const word of words) {
    for (const piece of pushWord(word)) {
      const candidate = line ? `${line} ${piece}` : piece;
      if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
      else { lines.push(line); line = piece; }
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s+\S*$/, '')}…`;
    return kept;
  }
  return lines;
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function emoji(ctx: CanvasRenderingContext2D, icon: string, x: number, y: number, size: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, 0, size * 0.05);
  ctx.restore();
}

/** Split narration into caption chunks of ~10 words */
export function captionChunks(narration: string): string[] {
  const sentences = narration.match(/[^.!?।]+[.!?।]?/g)?.map((s) => s.trim()).filter(Boolean) || [narration];
  const chunks: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    for (let i = 0; i < words.length; i += 11) chunks.push(words.slice(i, i + 11).join(' '));
  }
  return chunks.length ? chunks : [narration];
}

function currentCaption(narration: string, progress: number) {
  const chunks = captionChunks(narration);
  const total = chunks.reduce((n, c) => n + c.length, 0);
  let acc = 0;
  for (const chunk of chunks) {
    acc += chunk.length;
    if (progress <= acc / total) return chunk;
  }
  return chunks[chunks.length - 1];
}

// ------------------------------------------------------------------ pictures

type Picture = CanvasImageSource & { width: number; height: number };

/**
 * Draw a picture to cover a box, with a slow "Ken Burns" zoom and pan.
 * Direction alternates per scene so consecutive scenes don't move the same way.
 */
function drawPictureCover(
  ctx: CanvasRenderingContext2D, img: Picture, x: number, y: number, w: number, h: number,
  progress: number, sceneIndex: number,
) {
  const zoom = 1.04 + 0.1 * progress;
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dir = sceneIndex % 2 === 0 ? 1 : -1;
  const panX = (dw - w) * (0.5 + dir * (progress - 0.5) * 0.6);
  const panY = (dh - h) * 0.5;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x - panX, y - panY, dw, dh);
  ctx.restore();
}

/** Full-screen picture with a dark overlay so white text stays readable */
function drawPictureBackground(ctx: CanvasRenderingContext2D, img: Picture, progress: number, sceneIndex: number, from: 'left' | 'bottom') {
  drawPictureCover(ctx, img, 0, 0, WIDTH, HEIGHT, progress, sceneIndex);
  const g = from === 'left'
    ? ctx.createLinearGradient(0, 0, WIDTH, 0)
    : ctx.createLinearGradient(0, 0, 0, HEIGHT);
  if (from === 'left') {
    g.addColorStop(0, 'rgba(2,6,23,0.88)');
    g.addColorStop(0.55, 'rgba(2,6,23,0.55)');
    g.addColorStop(1, 'rgba(2,6,23,0.15)');
  } else {
    g.addColorStop(0, 'rgba(2,6,23,0.45)');
    g.addColorStop(0.45, 'rgba(2,6,23,0.25)');
    g.addColorStop(1, 'rgba(2,6,23,0.88)');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

/** Rounded picture panel on the right (for key points and steps) */
const PANEL = { x: 690, y: 112, w: 494, h: 470 };
function drawPicturePanel(ctx: CanvasRenderingContext2D, img: Picture, time: number, progress: number, sceneIndex: number, accent: string) {
  const a = appear(time, 0.15, 0.7);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate((1 - a) * 40, 0);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 40;
  roundRect(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 28);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.shadowBlur = 0;
  roundRect(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 28);
  ctx.clip();
  drawPictureCover(ctx, img, PANEL.x, PANEL.y, PANEL.w, PANEL.h, progress, sceneIndex);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate((1 - a) * 40, 0);
  ctx.strokeStyle = accent;
  ctx.globalAlpha = a * 0.6;
  ctx.lineWidth = 3;
  roundRect(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 28);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ layouts

const CONTENT_TOP = 120;
const MARGIN = 96;

const FULL: Area = { x: MARGIN, w: WIDTH - MARGIN * 2, icon: true };

function headingBlock(ctx: CanvasRenderingContext2D, heading: string, time: number, accent: string, area: Area = FULL, y = CONTENT_TOP) {
  const a = appear(time, 0.1);
  ctx.globalAlpha = a;
  ctx.fillStyle = '#ffffff';
  ctx.font = font(area.w < 800 ? 46 : 52, 700);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 12;
  const lines = wrap(ctx, heading, area.w - (area.icon ? 140 : 0), 2);
  const end = drawLines(ctx, lines, area.x + (1 - a) * -30, y, area.w < 800 ? 56 : 62);
  ctx.shadowBlur = 0;
  ctx.fillStyle = accent;
  ctx.fillRect(area.x, end + 14, 90 * a, 6);
  ctx.globalAlpha = 1;
  return end + 44;
}

function cornerIcon(ctx: CanvasRenderingContext2D, icon: string, time: number) {
  emoji(ctx, icon, WIDTH - MARGIN - 50, CONTENT_TOP + 40, 84, easeBack((time - 0.2) / 0.6));
}

/** When item i of n appears, spread over the first 75% of the scene */
const itemDelay = (i: number, n: number, duration: number) => 0.6 + (i * Math.max(duration * 0.75 - 0.6, 0.5)) / Math.max(n, 1);

function drawTitle(ctx: CanvasRenderingContext2D, f: FrameInfo, accent: string) {
  const { scene, time } = f;
  const withPicture = Boolean(f.image);
  if (!withPicture) emoji(ctx, scene.icon, WIDTH / 2, 250, 150, easeBack((time - 0.1) / 0.7));
  const a = appear(time, withPicture ? 0.3 : 0.5, 0.8);
  ctx.globalAlpha = a;
  ctx.fillStyle = '#ffffff';
  ctx.font = font(withPicture ? 72 : 64, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = withPicture ? 24 : 0;
  const lines = wrap(ctx, scene.heading, WIDTH - 240, 2);
  const end = drawLines(ctx, lines, WIDTH / 2, (withPicture ? 330 : 360) + (1 - a) * 20, withPicture ? 84 : 76);
  ctx.shadowBlur = 0;
  ctx.fillStyle = accent;
  roundRect(ctx, WIDTH / 2 - 60 * a, end + 18, 120 * a, 6, 3);
  ctx.fill();
  if (scene.bullets[0]) {
    ctx.globalAlpha = appear(time, 1.1);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = font(30, 500);
    drawLines(ctx, wrap(ctx, scene.bullets[0], WIDTH - 300, 1), WIDTH / 2, end + 44, 40);
  }
  ctx.globalAlpha = 1;
}

function drawList(ctx: CanvasRenderingContext2D, f: FrameInfo, accent: string, mode: 'bullets' | 'steps' | 'summary', area: Area = FULL) {
  const { scene, time, duration } = f;
  if (area.icon) cornerIcon(ctx, scene.icon, time);
  let y = headingBlock(ctx, scene.heading, time, accent, area) + 10;
  const narrow = area.w < 800;
  const items = scene.bullets;
  items.forEach((item, i) => {
    const a = appear(time, itemDelay(i, items.length, duration), 0.5);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    const x = area.x + (1 - a) * 40;
    const size = narrow ? 32 : 36;
    const lineH = narrow ? 42 : 46;
    ctx.font = font(size, 500);
    const lines = wrap(ctx, item, area.w - 80, narrow ? 3 : 2);
    const h = lines.length * lineH + 26;

    // marker
    if (mode === 'steps') {
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(x + 24, y + 30, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = font(26, 800);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x + 24, y + 31);
    } else if (mode === 'summary') {
      ctx.fillStyle = 'rgba(16,185,129,0.25)';
      ctx.beginPath(); ctx.arc(x + 24, y + 30, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6ee7b7'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + 14, y + 30); ctx.lineTo(x + 21, y + 38); ctx.lineTo(x + 35, y + 22); ctx.stroke();
    } else {
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(x + 24, y + 28, 9, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = font(size, 500);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10;
    drawLines(ctx, lines, x + 70, y + 8, lineH);
    ctx.shadowBlur = 0;
    y += h;
  });
  ctx.globalAlpha = 1;
}

function drawFact(ctx: CanvasRenderingContext2D, f: FrameInfo, accent: string, glow: string) {
  const { scene, time } = f;
  cornerIcon(ctx, scene.icon, time);
  const y = headingBlock(ctx, scene.heading, time, accent);
  const s = easeBack((time - 0.5) / 0.7);
  ctx.save();
  ctx.translate(WIDTH / 2, y + 150);
  ctx.scale(s, s);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(scene.highlight.length > 12 ? 92 : 140, 900);
  ctx.shadowColor = glow;
  ctx.shadowBlur = 40;
  const grad = ctx.createLinearGradient(-300, 0, 300, 0);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, accent);
  ctx.fillStyle = grad;
  ctx.fillText(scene.highlight, 0, 0);
  ctx.restore();
  if (scene.bullets[0]) {
    ctx.globalAlpha = appear(time, 1.2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = font(32, 500);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    drawLines(ctx, wrap(ctx, scene.bullets[0], WIDTH - 300, 2), WIDTH / 2, y + 260, 42);
    ctx.globalAlpha = 1;
  }
}

function drawCompare(ctx: CanvasRenderingContext2D, f: FrameInfo, accent: string) {
  const { scene, time, duration } = f;
  cornerIcon(ctx, scene.icon, time);
  const y = headingBlock(ctx, scene.heading, time, accent) + 6;
  const colW = (WIDTH - MARGIN * 2 - 40) / 2;
  const cardH = 600 - y;
  const columns: [string, string[], number][] = [
    [scene.leftTitle, scene.left, 0.5],
    [scene.rightTitle, scene.right, Math.max(1.2, duration * 0.45)],
  ];
  columns.forEach(([title, items, delay], c) => {
    const a = appear(time, delay, 0.6);
    if (a <= 0) return;
    const x = MARGIN + c * (colW + 40);
    ctx.globalAlpha = a;
    ctx.save();
    ctx.translate(0, (1 - a) * 30);
    ctx.fillStyle = f.image ? 'rgba(2,6,23,0.62)' : 'rgba(255,255,255,0.08)';
    ctx.strokeStyle = c === 0 ? accent : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, colW, cardH, 24);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = c === 0 ? accent : '#ffffff';
    ctx.font = font(36, 800);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    drawLines(ctx, wrap(ctx, title, colW - 60, 1), x + 30, y + 28, 44);
    let iy = y + 92;
    ctx.font = font(30, 500);
    ctx.fillStyle = '#ffffff';
    for (const item of items) {
      const lines = wrap(ctx, `• ${item}`, colW - 60, 2);
      iy = drawLines(ctx, lines, x + 30, iy, 40) + 14;
    }
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ frame

export function drawFrame(ctx: CanvasRenderingContext2D, f: FrameInfo) {
  const palette = PALETTES[f.sceneIndex % PALETTES.length];
  const { time, duration } = f;
  const progress = duration > 0 ? clamp(time / duration) : 0;

  // background + slowly drifting glows
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, palette.from);
  bg.addColorStop(1, palette.to);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glows: [number, number, number][] = [[0.15, 0.2, 380], [0.85, 0.75, 420], [0.7, 0.1, 260]];
  glows.forEach(([gx, gy, r], i) => {
    const x = WIDTH * gx + Math.sin(time * 0.4 + i * 2) * 40;
    const y = HEIGHT * gy + Math.cos(time * 0.35 + i) * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `${palette.glow}55`);
    g.addColorStop(1, `${palette.glow}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  });

  // AI picture (if any): full-screen background, or a panel for list layouts
  const picture = f.image || null;
  const panelLayout = f.scene.layout === 'bullets' || f.scene.layout === 'steps';
  if (picture && !panelLayout) {
    drawPictureBackground(ctx, picture, progress, f.sceneIndex, f.scene.layout === 'title' ? 'bottom' : 'left');
  }

  if (picture) {
    // dark band so the top bar stays readable on bright pictures
    const top = ctx.createLinearGradient(0, 0, 0, 130);
    top.addColorStop(0, 'rgba(2,6,23,0.7)');
    top.addColorStop(1, 'rgba(2,6,23,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, WIDTH, 130);
    if (f.scene.layout === 'title') {
      // soft dark glow behind the centred title
      const g = ctx.createRadialGradient(WIDTH / 2, 380, 40, WIDTH / 2, 380, 560);
      g.addColorStop(0, 'rgba(2,6,23,0.6)');
      g.addColorStop(1, 'rgba(2,6,23,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  // top bar: lesson title + scene counter
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#ffffff';
  ctx.font = font(22, 600);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(wrap(ctx, `🎓 ${f.lessonTitle}`, WIDTH - 400, 1)[0] || '', MARGIN - 40, 50);
  ctx.textAlign = 'right';
  ctx.fillText(`${f.sceneIndex + 1} / ${f.sceneCount}`, WIDTH - MARGIN + 40, 50);
  ctx.globalAlpha = 1;

  // scene content
  const listArea: Area = picture && panelLayout ? { x: MARGIN - 20, w: PANEL.x - MARGIN - 20, icon: false } : FULL;
  if (picture && panelLayout) drawPicturePanel(ctx, picture, time, progress, f.sceneIndex, palette.accent);
  switch (f.scene.layout) {
    case 'title': drawTitle(ctx, f, palette.accent); break;
    case 'fact': drawFact(ctx, f, palette.accent, palette.glow); break;
    case 'compare': drawCompare(ctx, f, palette.accent); break;
    case 'steps': drawList(ctx, f, palette.accent, 'steps', listArea); break;
    case 'summary': drawList(ctx, f, palette.accent, 'summary', picture ? { x: MARGIN, w: 760, icon: false } : FULL); break;
    default: drawList(ctx, f, palette.accent, 'bullets', listArea);
  }

  // captions
  if (f.captions && f.scene.narration) {
    const text = currentCaption(f.scene.narration, progress);
    ctx.font = font(28, 500);
    const lines = wrap(ctx, text, WIDTH - 320, 2);
    const boxH = lines.length * 38 + 24;
    const boxW = Math.min(WIDTH - 260, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 56);
    ctx.fillStyle = 'rgba(2,6,23,0.72)';
    roundRect(ctx, (WIDTH - boxW) / 2, HEIGHT - 40 - boxH, boxW, boxH, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    drawLines(ctx, lines, WIDTH / 2, HEIGHT - 40 - boxH + 12, 38);
  }

  // overall progress bar
  const overall = (f.sceneIndex + progress) / Math.max(f.sceneCount, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(0, HEIGHT - 6, WIDTH, 6);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(0, HEIGHT - 6, WIDTH * overall, 6);
}

/** Rough speaking time when there's no audio file (browser voice): ~2.6 words/sec */
export function estimateDuration(narration: string): number {
  const words = narration.split(/\s+/).filter(Boolean).length;
  const chars = narration.replace(/\s/g, '').length;
  return Math.max(4, Math.max(words / 2.6, chars / 14));
}
