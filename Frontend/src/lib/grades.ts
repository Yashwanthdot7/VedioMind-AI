/** Grade scale (keep in sync with backend/src/lib/grades.js): A+ ≥ 90 · A ≥ 80 · B ≥ 70 · C ≥ 60 · D < 60 */
export const GRADES = ['A+', 'A', 'B', 'C', 'D'] as const;
export type Grade = (typeof GRADES)[number];

const MIN: Record<Grade, number> = { 'A+': 90, A: 80, B: 70, C: 60, D: 0 };

export function gradeFor(scorePct: number): Grade {
  return GRADES.find((g) => scorePct >= MIN[g]) ?? 'D';
}

/** Badge styling for a grade (always shown with the grade text, never colour alone) */
export function gradeClass(grade: string): string {
  switch (grade) {
    case 'A+':
    case 'A': return 'bg-lagoon-500/15 text-lagoon-300 border-lagoon-500/40';
    case 'B': return 'bg-ink-700/60 text-ink-100 border-ink-500/60';
    case 'C': return 'bg-amber-500/15 text-amber-200 border-amber-500/30';
    default: return 'bg-red-500/15 text-red-300 border-red-500/30';
  }
}
