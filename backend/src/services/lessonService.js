const { SchemaType } = require('@google/generative-ai');
const AppError = require('../lib/AppError');
const geminiService = require('./geminiService');
const { wrapGeminiError } = require('./geminiService');
const { languageName } = require('../config/languages');
const textrank = require('./textrank');
const { LEVELS, LEVEL_GUIDANCE } = require('../config/learner');

/**
 * Writes the script for a narrated video lesson: a list of scenes, each with
 * narration (spoken), a slide layout and a 3D picture prompt (shown).
 * Quizzes are generated separately, only when the viewer asks for one.
 */

const S = SchemaType;
const str = (description) => ({ type: S.STRING, ...(description && { description }) });
const strList = (description) => ({ type: S.ARRAY, items: str(), ...(description && { description }) });

const LAYOUTS = ['title', 'bullets', 'fact', 'steps', 'compare', 'summary'];

const LESSON_SCHEMA = {
    type: S.OBJECT,
    properties: {
        title: str('Lesson title, max 8 words'),
        scenes: {
            type: S.ARRAY,
            items: {
                type: S.OBJECT,
                properties: {
                    layout: { type: S.STRING, format: 'enum', enum: LAYOUTS },
                    icon: str('ONE emoji that represents this scene'),
                    heading: str('Slide heading, max 7 words'),
                    narration: str('What the narrator says during this scene'),
                    imagePrompt: str('IN ENGLISH: a concrete description of ONE 3D educational render that illustrates this scene: the 3D model / cutaway / figures shown, what they do, camera angle. No text or labels.'),
                    bullets: strList('Short on-screen points (max 6 words each). bullets/steps: 2-4 items; summary: 3-4; others: empty'),
                    highlight: str('fact layout: a big number, word or short phrase to show. Otherwise empty'),
                    leftTitle: str('compare layout: left column title. Otherwise empty'),
                    left: strList('compare layout: 2-3 short points. Otherwise empty'),
                    rightTitle: str('compare layout: right column title. Otherwise empty'),
                    right: strList('compare layout: 2-3 short points. Otherwise empty'),
                },
                required: ['layout', 'icon', 'heading', 'narration', 'imagePrompt', 'bullets', 'highlight', 'leftTitle', 'left', 'rightTitle', 'right'],
            },
        },
    },
    required: ['title', 'scenes'],
};

const AUDIENCE = {
    kids: {
        guide: 'The viewers are children aged 8-12. Use very simple words, short sentences, a warm and playful tone, fun everyday examples and comparisons. Ask the viewer a simple question now and then.',
        voiceStyle: 'Say this in a warm, cheerful and lively voice, like a friendly teacher talking to children',
    },
    student: {
        guide: 'The viewers are high-school or college students. Be clear, accurate and well structured, with examples, and focus on what matters for understanding and exams.',
        voiceStyle: 'Say this in a clear, friendly and confident teaching voice',
    },
    teacher: {
        guide: 'The viewers are teachers who may show this in class. Be precise, explain concepts step by step, mention a common misconception, and end with discussion points.',
        voiceStyle: 'Say this in a calm, clear and professional voice',
    },
};

const TEACHER_MODES = ['guide', 'class'];

const TEACHING_GUIDE = `This video is a TEACHING GUIDE for the teacher, not a video for the class. Speak to the teacher in the second person ("Start by asking your class..."). Coach them through how to teach this topic, in this order across the scenes:
1. a hook to open the class (a question, demo or everyday example),
2. each key idea, explained the way it should be explained to students, with the simplest analogy that works,
3. the most common student misconception and how to correct it,
4. one short class activity (5-10 minutes, no special equipment),
5. three questions to check understanding.
Be practical, specific and encouraging.`;

/**
 * Who the script is written for, and the narrator's voice style.
 *  kids                      simple and playful
 *  student + level           at the learner's level (beginner / intermediate / advanced)
 *  teacher + guide           coaches the teacher how to teach it
 *  teacher + class           a video to show the class (at the chosen level), with separate teacher notes
 */
function audienceFor({ audience, level = 'intermediate', teacherMode = null }) {
    const lvl = LEVELS.includes(level) ? level : 'intermediate';
    if (audience === 'kids') return { guide: AUDIENCE.kids.guide, voiceStyle: AUDIENCE.kids.voiceStyle };
    if (audience === 'teacher' && teacherMode !== 'class') {
        return { guide: `${AUDIENCE.teacher.guide}\n\n${TEACHING_GUIDE}`, voiceStyle: AUDIENCE.teacher.voiceStyle };
    }
    const forClass = audience === 'teacher' ? ' A teacher will show this video to their class.' : '';
    return { guide: `${AUDIENCE.student.guide}${forClass}\n${LEVEL_GUIDANCE[lvl]}`, voiceStyle: AUDIENCE.student.voiceStyle };
}

const LENGTHS = {
    short: { scenes: '5-6', sceneCount: 6, words: '25-35', label: 'about 1 minute', budget: 6000 },
    standard: { scenes: '8-10', sceneCount: 9, words: '30-45', label: 'about 2-3 minutes', budget: 10000 },
};

/** Planner: "textrank" (default) condenses long material first; "off" sends it as is */
const plannerEnabled = () => (process.env.LESSON_PLANNER || 'textrank').toLowerCase() !== 'off';

/**
 * Long material (big notes, a 40-minute transcript) is condensed to its key sentences
 * with TextRank, and one key idea per scene is suggested, spread across the material.
 * Short material goes to the model unchanged.
 */
function planMaterial(material, length) {
    const len = LENGTHS[length] || LENGTHS.short;
    if (!plannerEnabled()) return { planned: false, material, plan: [], stats: null };
    return textrank.planLesson(material, { maxChars: len.budget, sceneCount: len.sceneCount });
}

function buildPrompt({ material, audience, language, length, plan = [], context = '', level, teacherMode }) {
    const len = LENGTHS[length];
    const planText = plan.length
        ? `\nThe material was condensed to its key sentences. Suggested key ideas, in order (one or two scenes each; merge or skip if they repeat):\n${plan.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n`
        : '';
    return `You are an expert educator and video script writer. Create a narrated explainer video lesson (${len.label}) from the material below.

${audienceFor({ audience, level, teacherMode }).guide}

Structure:
- ${len.scenes} scenes. Scene 1 uses the "title" layout and introduces the topic with a hook. The last scene uses the "summary" layout.
- In between, choose the layout that best fits each idea: "bullets" (key points), "fact" (one striking number/word), "steps" (a process in order), "compare" (two things side by side).
- Each scene's narration is ${len.words} words, spoken naturally and flowing on from the previous scene. Never read the bullets word for word; the slide supports what is said.
- On-screen text must be very short.
- For every scene, write "imagePrompt" in English: a 3D educational render that shows the idea of the scene, like a science-museum model (e.g. "3D cutaway of a volcano showing a glowing magma chamber and lava rising through cracks to the crater, side view"). Prefer models, cutaways and objects; a person or figure may demonstrate something. Never ask for text, labels or diagrams with words.

Write ALL text (titles, narration, slides) in ${languageName(language)}, except "imagePrompt", which is always in English. Emojis stay as emojis.
Stay accurate to the material; do not invent facts.
${context ? `\n${context}\n` : ''}${planText}
Material:
${material}`;
}

// ------------------------------------------------------------------ cleaning

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const list = (v, maxItems, maxLen) => (Array.isArray(v) ? v : []).map((x) => clean(x, maxLen)).filter(Boolean).slice(0, maxItems);

function normalise(raw) {
    const scenes = (Array.isArray(raw.scenes) ? raw.scenes : []).map((s) => {
        const layout = LAYOUTS.includes(s.layout) ? s.layout : 'bullets';
        const scene = {
            layout,
            icon: clean(s.icon, 16) || '💡',
            heading: clean(s.heading, 90),
            narration: clean(s.narration, 900),
            imagePrompt: clean(s.imagePrompt, 600),
            bullets: list(s.bullets, 5, 90),
            highlight: clean(s.highlight, 40),
            leftTitle: clean(s.leftTitle, 40),
            left: list(s.left, 4, 70),
            rightTitle: clean(s.rightTitle, 40),
            right: list(s.right, 4, 70),
        };
        // Fall back to a simpler layout when the model left the needed fields empty
        if (layout === 'compare' && (!scene.left.length || !scene.right.length)) {
            scene.layout = 'bullets';
            if (!scene.bullets.length) scene.bullets = [...scene.left, ...scene.right].slice(0, 5);
        }
        if (layout === 'fact' && !scene.highlight) scene.layout = scene.bullets.length ? 'bullets' : 'title';
        if ((scene.layout === 'bullets' || scene.layout === 'steps' || scene.layout === 'summary') && !scene.bullets.length) scene.layout = 'title';
        return scene;
    }).filter((s) => s.narration && s.heading).slice(0, 12);

    return { title: clean(raw.title, 100), scenes };
}

// ------------------------------------------------------------------ quiz on demand

const QUIZ_SCHEMA = {
    type: S.OBJECT,
    properties: {
        questions: {
            type: S.ARRAY,
            items: {
                type: S.OBJECT,
                properties: {
                    question: str(),
                    options: strList('Exactly 4 options'),
                    answerIndex: { type: S.INTEGER, description: 'Index (0-3) of the correct option' },
                    explanation: str('One or two sentences'),
                    difficulty: { type: S.STRING, format: 'enum', enum: ['easy', 'medium', 'hard'] },
                    scene: { type: S.INTEGER, description: 'Number (1-based) of the scene this question is about' },
                },
                required: ['question', 'options', 'answerIndex', 'explanation', 'difficulty', 'scene'],
            },
        },
    },
    required: ['questions'],
};

const QUIZ_KINDS = {
    quick: { count: 5, mix: '2 easy, 2 medium, 1 hard' },
    test: { count: 10, mix: '3 easy, 5 medium, 2 hard' },
};

function normaliseQuiz(raw, sceneCount, max) {
    return (Array.isArray(raw?.questions) ? raw.questions : []).map((q) => ({
        question: clean(q.question, 400),
        options: list(q.options, 4, 200),
        answerIndex: Number(q.answerIndex),
        explanation: clean(q.explanation, 400),
        difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
        scene: Number.isInteger(q.scene) && q.scene >= 1 && q.scene <= sceneCount ? q.scene - 1 : null,
        timestamp: '',
    })).filter((q) => q.question && q.options.length >= 2 && Number.isInteger(q.answerIndex)
        && q.answerIndex >= 0 && q.answerIndex < q.options.length).slice(0, max);
}

/** Generate a quiz (5 questions) or test (10) from a finished lesson's narration */
async function writeQuiz(lesson, kind = 'quick') {
    const spec = QUIZ_KINDS[kind] || QUIZ_KINDS.quick;
    const scenes = lesson.scenes.map((s, i) => `Scene ${i + 1} — ${s.heading}: ${s.narration}`).join('\n');
    const prompt = `Write a ${spec.count}-question multiple-choice ${kind === 'test' ? 'test' : 'quiz'} for this video lesson.

${audienceFor({ audience: lesson.audience === 'teacher' ? 'student' : lesson.audience, level: lesson.level }).guide}
${lesson.audience === 'teacher' ? 'The questions are for the teacher\'s students.\n' : ''}
Rules:
- Difficulty mix: ${spec.mix}. Mark each question's difficulty.
- Exactly 4 options per question, one correct answer, plausible wrong options.
- Only ask about what the lesson actually says. Give a short explanation for each answer and the scene number it comes from.
- Write everything in ${languageName(lesson.language)}.

Lesson: ${lesson.title}
${scenes}`;

    let raw;
    try {
        raw = await geminiService.withModel({
            generationConfig: { responseMimeType: 'application/json', responseSchema: QUIZ_SCHEMA, temperature: 0.6 },
        }, async (model) => (await model.generateContent(prompt)).response.text());
    } catch (error) {
        throw wrapGeminiError(error, 'Failed to create the quiz. Please try again.');
    }

    let questions;
    try {
        questions = normaliseQuiz(JSON.parse(raw), lesson.scenes.length, spec.count);
    } catch {
        throw new AppError('The AI returned an unexpected quiz format. Please try again.', 502, 'AI_BAD_OUTPUT');
    }
    if (!questions.length) throw new AppError('The AI could not create a quiz for this lesson. Please try again.', 502, 'AI_BAD_OUTPUT');
    return questions;
}

/** Material from a processed YouTube video (plain transcript text: timestamps aren't needed for a lesson) */
function materialFromVideo(context) {
    const transcript = (context.transcript || []).map((s) => s.text).join(' ').replace(/\s+/g, ' ').slice(0, 120000);
    return `Video title: ${context.title}

Summary:
${context.summary || ''}

Transcript:
${transcript}`;
}

async function writeScript({ material, audience, language, length, context = '', level, teacherMode }) {
    const planning = planMaterial(material, length);
    const options = {
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: LESSON_SCHEMA,
            temperature: 0.7,
        },
    };

    let raw;
    try {
        raw = await geminiService.withModel(options, async (model) => {
            const result = await model.generateContent(buildPrompt({ material: planning.material, audience, language, length, plan: planning.plan, context, level, teacherMode }));
            return result.response.text();
        });
    } catch (error) {
        throw wrapGeminiError(error, 'Failed to write the lesson script. Please try again.');
    }

    let lesson;
    try {
        lesson = normalise(JSON.parse(raw));
    } catch {
        throw new AppError('The AI returned an unexpected script format. Please try again.', 502, 'AI_BAD_OUTPUT');
    }
    if (lesson.scenes.length < 2) {
        throw new AppError('The AI could not write a lesson from this material. Try adding more detail.', 422, 'AI_BAD_OUTPUT');
    }
    lesson.planning = planning.planned
        ? { method: 'textrank', ...planning.stats, ideas: planning.plan.length }
        : { method: 'none', inputChars: String(material).length };
    return lesson;
}

// ------------------------------------------------------------------ teacher's lesson plan

const PLAN_SCHEMA = {
    type: S.OBJECT,
    properties: {
        objectives: strList('2-4 learning objectives, each starting with a verb ("Explain...", "Identify...")'),
        durationMinutes: { type: S.INTEGER, description: 'Total class time in minutes, 30-60' },
        materials: strList('Things to prepare; empty if none'),
        steps: {
            type: S.ARRAY,
            items: {
                type: S.OBJECT,
                properties: {
                    minutes: { type: S.INTEGER },
                    title: str('Short step name'),
                    teacher: str('What the teacher does or says'),
                    students: str('What the students do'),
                    scene: { type: S.INTEGER, description: 'Video scene number to show or pause at, or 0' },
                },
                required: ['minutes', 'title', 'teacher', 'students', 'scene'],
            },
        },
        misconceptions: {
            type: S.ARRAY,
            items: { type: S.OBJECT, properties: { misconception: str(), fix: str('How to correct it') }, required: ['misconception', 'fix'] },
        },
        activity: { type: S.OBJECT, properties: { title: str(), instructions: str() }, required: ['title', 'instructions'] },
        questions: strList('4-6 discussion or check-for-understanding questions'),
        exitTicket: strList('2-3 quick questions students answer before leaving'),
        differentiation: str('One line each on helping students who struggle and stretching those who finish early'),
    },
    required: ['objectives', 'durationMinutes', 'materials', 'steps', 'misconceptions', 'activity', 'questions', 'exitTicket', 'differentiation'],
};

function normalisePlan(raw) {
    const steps = (Array.isArray(raw?.steps) ? raw.steps : []).map((s) => ({
        minutes: Math.max(1, Math.min(60, Number.parseInt(s?.minutes, 10) || 5)),
        title: clean(s?.title, 80),
        teacher: clean(s?.teacher, 600),
        students: clean(s?.students, 400),
        scene: Math.max(0, Number.parseInt(s?.scene, 10) || 0),
    })).filter((s) => s.title).slice(0, 10);
    return {
        objectives: list(raw?.objectives, 5, 200),
        durationMinutes: Math.max(10, Math.min(120, Number.parseInt(raw?.durationMinutes, 10) || steps.reduce((n, s) => n + s.minutes, 0) || 40)),
        materials: list(raw?.materials, 8, 160),
        steps,
        misconceptions: (Array.isArray(raw?.misconceptions) ? raw.misconceptions : [])
            .map((m) => ({ misconception: clean(m?.misconception, 300), fix: clean(m?.fix, 400) }))
            .filter((m) => m.misconception).slice(0, 4),
        activity: { title: clean(raw?.activity?.title, 100), instructions: clean(raw?.activity?.instructions, 1200) },
        questions: list(raw?.questions, 8, 240),
        exitTicket: list(raw?.exitTicket, 4, 240),
        differentiation: clean(raw?.differentiation, 600),
    };
}

/**
 * A printable lesson plan for a finished lesson. In "guide" mode it is the teacher's own plan;
 * in "class" mode it is the notes to teach alongside the video (when to pause, what to ask).
 */
async function writeTeacherPlan(lesson) {
    const scenes = lesson.scenes.map((s, i) => `Scene ${i + 1}: ${s.heading}. ${s.narration}`).join('\n');
    const mode = lesson.teacherMode === 'class'
        ? 'The teacher will SHOW this video to the class. Plan the lesson around it: what to do before playing it, where to pause (use the scene numbers) and what to ask, and what to do after.'
        : 'The video is the teacher\'s own guide. Turn it into a plan the teacher can follow in class without the video. Use scene numbers only as references, or 0.';
    const prompt = `Write a practical lesson plan for a teacher.

${mode}
Students' level: ${lesson.level || 'intermediate'}.
Write everything in ${languageName(lesson.language)}. Stay accurate to the lesson; do not invent facts.

Lesson: ${lesson.title}
${scenes}`;
    let raw;
    try {
        raw = await geminiService.withModel({
            generationConfig: { responseMimeType: 'application/json', responseSchema: PLAN_SCHEMA, temperature: 0.5 },
        }, async (model) => (await model.generateContent(prompt)).response.text());
    } catch (error) {
        throw wrapGeminiError(error, 'Failed to write the lesson plan. Please try again.');
    }
    let plan;
    try {
        plan = normalisePlan(JSON.parse(raw));
    } catch {
        throw new AppError('The AI returned an unexpected lesson plan. Please try again.', 502, 'AI_BAD_OUTPUT');
    }
    if (!plan.steps.length) throw new AppError('The AI could not write a lesson plan. Please try again.', 502, 'AI_BAD_OUTPUT');
    return plan;
}

module.exports = {
    LAYOUTS, AUDIENCE, TEACHER_MODES, audienceFor, writeTeacherPlan, normalisePlan, PLAN_SCHEMA, LENGTHS, LESSON_SCHEMA, QUIZ_KINDS, buildPrompt, planMaterial, normalise, normaliseQuiz, materialFromVideo, writeScript, writeQuiz,
};
