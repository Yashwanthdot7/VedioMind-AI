const { SchemaType } = require('@google/generative-ai');
const AppError = require('../lib/AppError');
const geminiService = require('./geminiService');
const { formatTranscript, wrapGeminiError } = require('./geminiService');
const { languageName } = require('../config/languages');

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

const LENGTHS = {
    short: { scenes: '5-6', words: '25-35', label: 'about 1 minute' },
    standard: { scenes: '8-10', words: '30-45', label: 'about 2-3 minutes' },
};

function buildPrompt({ material, audience, language, length }) {
    const len = LENGTHS[length];
    return `You are an expert educator and video script writer. Create a narrated explainer video lesson (${len.label}) from the material below.

${AUDIENCE[audience].guide}

Structure:
- ${len.scenes} scenes. Scene 1 uses the "title" layout and introduces the topic with a hook. The last scene uses the "summary" layout.
- In between, choose the layout that best fits each idea: "bullets" (key points), "fact" (one striking number/word), "steps" (a process in order), "compare" (two things side by side).
- Each scene's narration is ${len.words} words, spoken naturally and flowing on from the previous scene. Never read the bullets word for word; the slide supports what is said.
- On-screen text must be very short.
- For every scene, write "imagePrompt" in English: a 3D educational render that shows the idea of the scene, like a science-museum model (e.g. "3D cutaway of a volcano showing a glowing magma chamber and lava rising through cracks to the crater, side view"). Prefer models, cutaways and objects; a person or figure may demonstrate something. Never ask for text, labels or diagrams with words.

Write ALL text (titles, narration, slides) in ${languageName(language)}, except "imagePrompt", which is always in English. Emojis stay as emojis.
Stay accurate to the material; do not invent facts.

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

${AUDIENCE[lesson.audience].guide}

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

/** Material from a processed YouTube video */
function materialFromVideo(context) {
    return `Video title: ${context.title}

Summary:
${context.summary || ''}

Transcript:
${formatTranscript(context.transcript, 120000)}`;
}

async function writeScript({ material, audience, language, length }) {
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
            const result = await model.generateContent(buildPrompt({ material, audience, language, length }));
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
    return lesson;
}

module.exports = {
    LAYOUTS, AUDIENCE, LENGTHS, LESSON_SCHEMA, QUIZ_KINDS, buildPrompt, normalise, normaliseQuiz, materialFromVideo, writeScript, writeQuiz,
};
