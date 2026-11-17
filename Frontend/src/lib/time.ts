/** "4:32" -> 272, "1:02:05" -> 3725. Returns null if not a timestamp. */
export function parseTimestamp(value: string): number | null {
  const parts = value.trim().split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n >= 60)) return null;
  return nums.reduce((total, n) => total * 60 + n, 0);
}

/** 272 -> "4:32" */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds && totalSeconds !== 0) return '';
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
