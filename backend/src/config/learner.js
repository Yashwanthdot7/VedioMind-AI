/**
 * Who the learner is, chosen at sign-up and changeable in settings:
 *   role  student | teacher
 *   level beginner | intermediate | advanced   (students; teachers default to intermediate)
 *
 * Every AI feature (summaries, chat, study tools, lessons, courses) reads req.learner.
 */

const ROLES = ['student', 'teacher'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const DEFAULT_LEARNER = Object.freeze({ role: 'student', level: 'intermediate' });

const LEVEL_GUIDANCE = {
    beginner: 'The learner is a BEGINNER in this subject. Assume no background. Explain every technical word in plain language the first time it appears, use one everyday analogy per idea, keep sentences short, build up step by step, and leave out advanced details.',
    intermediate: 'The learner knows the basics of this subject. Be clear and accurate, use the standard terms with a short reminder of what they mean, and give a concrete example for each main idea.',
    advanced: 'The learner is ADVANCED in this subject. Be concise and precise, use proper terminology without over-explaining basics, and go deeper: why and how things work, edge cases, links to related ideas, and common subtleties.',
};

const TEACHER_GUIDANCE = 'The user is a TEACHER preparing to teach this topic. Besides explaining the content, point out how to explain it to a class, likely student misconceptions, and good questions to ask.';

function normaliseLearner(input) {
    const role = ROLES.includes(input?.role) ? input.role : DEFAULT_LEARNER.role;
    const level = LEVELS.includes(input?.level) ? input.level : DEFAULT_LEARNER.level;
    return { role, level };
}

/** "student:beginner" (X-Learner header sent by guests) -> { role, level } */
function parseLearnerHeader(value) {
    if (typeof value !== 'string' || value.length > 40) return { ...DEFAULT_LEARNER };
    const [role, level] = value.split(':');
    return normaliseLearner({ role, level });
}

/** One paragraph for a prompt */
function learnerGuidance(learner) {
    const { role, level } = normaliseLearner(learner);
    return role === 'teacher' ? TEACHER_GUIDANCE : LEVEL_GUIDANCE[level];
}

module.exports = {
    ROLES, LEVELS, DEFAULT_LEARNER, LEVEL_GUIDANCE, TEACHER_GUIDANCE, normaliseLearner, parseLearnerHeader, learnerGuidance,
};
