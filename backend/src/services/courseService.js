const { SchemaType } = require('@google/generative-ai');
const AppError = require('../lib/AppError');
const geminiService = require('./geminiService');
const { wrapGeminiError } = require('./geminiService');
const { languageName } = require('../config/languages');
const lessonService = require('./lessonService');
const textrank = require('./textrank');

/**
 * Course mode: a big topic or long material becomes an ordered set of modules,
 * each one a normal narrated lesson.
 *
 *  1. outline()      Gemini plans the course: a title and 3-5 modules, each with a goal and key points
 *  2. splitMaterial() gives every module its own part of the material: each sentence goes to the
 *                     module whose key points share the most words with it, so module 3 is written
 *                     from what the source says about module 3's topic, not from the whole text
 *  3. moduleMaterial() adds the course context so modules flow on from each other
 */

const S = SchemaType;
const MIN_MODULES = 3;
const MAX_MODULES = 5;
const OUTLINE_BUDGET = 8000; // characters of (condensed) material the outline is written from
const MODULE_BUDGET = 9000;

const OUTLINE_SCHEMA = {
    type: S.OBJECT,
    properties: {
        title: { type: S.STRING, description: 'Course title, max 8 words' },
        modules: {
            type: S.ARRAY,
            items: {
                type: S.OBJECT,
                properties: {
                    title: { type: S.STRING, description: 'Module title, max 7 words' },
                    goal: { type: S.STRING, description: 'One sentence: what the learner can do after this module' },
                    keyPoints: { type: S.ARRAY, items: { type: S.STRING }, description: '3-4 short points this module covers' },
                },
                required: ['title', 'goal', 'keyPoints'],
            },
        },
    },
    required: ['title', 'modules'],
};

function clampModules(n) {
    const v = Number.parseInt(n, 10);
    if (!Number.isFinite(v)) return 4;
    return Math.min(MAX_MODULES, Math.max(MIN_MODULES, v));
}

function buildOutlinePrompt({ material, audience, language, moduleCount }) {
    return `You are planning a short video course. Split the material below into exactly ${moduleCount} modules that build on each other, from the basics to the more advanced ideas.

${lessonService.AUDIENCE[audience].guide}

- Each module becomes a separate 1-2 minute narrated lesson, so give each one a clear, separate focus. Do not repeat a topic in two modules.
- Module 1 introduces the topic. The last module brings the ideas together or applies them.
- Key points are short and concrete, and must come from the material (or from well-established facts if the material is only a topic).

Write everything in ${languageName(language)}.

Material:
${material}`;
}

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function normaliseOutline(raw, moduleCount) {
    const modules = (Array.isArray(raw?.modules) ? raw.modules : [])
        .map((m) => ({
            title: clean(m?.title, 80),
            goal: clean(m?.goal, 240),
            keyPoints: (Array.isArray(m?.keyPoints) ? m.keyPoints : []).map((p) => clean(p, 160)).filter(Boolean).slice(0, 4),
        }))
        .filter((m) => m.title)
        .slice(0, moduleCount);
    return { title: clean(raw?.title, 100) || 'New course', modules };
}

async function outline({ material, audience, language, moduleCount }) {
    const count = clampModules(moduleCount);
    const condensed = textrank.planLesson(material, { maxChars: OUTLINE_BUDGET, sceneCount: count + 2 }).material;
    let raw;
    try {
        raw = await geminiService.withModel({
            generationConfig: { responseMimeType: 'application/json', responseSchema: OUTLINE_SCHEMA, temperature: 0.5 },
        }, async (model) => {
            const result = await model.generateContent(buildOutlinePrompt({ material: condensed, audience, language, moduleCount: count }));
            return result.response.text();
        });
    } catch (error) {
        throw wrapGeminiError(error, 'Failed to plan the course. Please try again.');
    }
    let plan;
    try {
        plan = normaliseOutline(JSON.parse(raw), count);
    } catch {
        throw new AppError('The AI returned an unexpected course plan. Please try again.', 502, 'AI_BAD_OUTPUT');
    }
    if (plan.modules.length < 2) {
        throw new AppError('The AI could not split this into modules. Try a broader topic or more material.', 422, 'AI_BAD_OUTPUT');
    }
    return plan;
}

/**
 * Give each module the sentences of the material that are about it (kept in source order).
 * Short material (a topic, a paragraph) is shared by all modules unchanged.
 * @returns {string[]} one material string per module
 */
function splitMaterial(material, modules) {
    const text = String(material || '');
    const sentences = textrank.splitSentences(text);
    if (text.length < 2500 || sentences.length < modules.length * 4) return modules.map(() => text);

    const bags = modules.map((m) => new Set(textrank.words(`${m.title} ${m.goal} ${m.keyPoints.join(' ')}`)));
    const buckets = modules.map(() => []);
    let previous = 0;
    sentences.forEach((sentence) => {
        const w = textrank.words(sentence);
        let best = -1;
        let bestScore = 0;
        bags.forEach((bag, k) => {
            const score = w.reduce((n, word) => n + (bag.has(word) ? 1 : 0), 0);
            if (score > bestScore) { bestScore = score; best = k; }
        });
        // No overlap at all: it most likely continues the section before it
        const target = best === -1 ? previous : best;
        buckets[target].push(sentence);
        previous = target;
    });

    return buckets.map((list, k) => {
        // A module the source says little about still gets its key points to work from
        const own = list.join(' ');
        const material_ = own.length >= 300 ? own : `${own}\n\n${text.slice(0, 3000)}`;
        return textrank.planLesson(material_, { maxChars: MODULE_BUDGET, sceneCount: 6 }).material;
    });
}

/** Course context for module k (sent next to, not condensed with, the module's material) */
function moduleContext({ course, index }) {
    const m = course.modules[index];
    const others = course.modules.map((x, i) => `${i + 1}. ${x.title}${i === index ? '  <- this module' : ''}`).join('\n');
    return `This lesson is module ${index + 1} of ${course.modules.length} in the course "${course.title}".
Course modules:
${others}

This module: ${m.title}
Goal: ${m.goal}
Cover these points: ${m.keyPoints.join('; ')}
${index > 0 ? 'Viewers have watched the earlier modules, so do not re-introduce the whole course; open with a short link to the previous module.' : 'This is the first module, so introduce the course topic.'}
${index < course.modules.length - 1 ? `End by hinting at the next module: ${course.modules[index + 1].title}.` : 'This is the last module: end with a short recap of the whole course.'}`;
}

module.exports = {
    MIN_MODULES, MAX_MODULES, OUTLINE_SCHEMA, clampModules, buildOutlinePrompt, normaliseOutline, outline, splitMaterial, moduleContext,
};
