/**
 * Grade scale used everywhere (keep in sync with Frontend/src/lib/grades.ts)
 * A+ ≥ 90 · A ≥ 80 · B ≥ 70 · C ≥ 60 · D < 60
 */
const GRADES = [
    { grade: 'A+', min: 90 },
    { grade: 'A', min: 80 },
    { grade: 'B', min: 70 },
    { grade: 'C', min: 60 },
    { grade: 'D', min: 0 },
];

function gradeFor(scorePct) {
    return GRADES.find((g) => scorePct >= g.min).grade;
}

module.exports = { GRADES, gradeFor };
