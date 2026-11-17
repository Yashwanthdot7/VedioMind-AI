/** Save text as a file in the browser */
export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "My Video: Part 1?" -> "my-video-part-1" (keeps non-Latin letters) */
export function slugify(value: string, max = 60): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max) || 'videomind';
}

/** CSV cell: quote and escape */
export const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
