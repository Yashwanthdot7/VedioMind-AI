const { SchemaType } = require('@google/generative-ai');
const { LEVEL_GUIDANCE: LEARNER_LEVELS } = require('../config/learner');
const AppError = require('../lib/AppError');
const geminiService = require('./geminiService');
const { formatTranscript, wrapGeminiError } = require('./geminiService');
const { languageName } = require('../config/languages');
const { LIMITS } = require('../types/constants');

/**
 * Study materials generated from a video: notes, quiz, flashcards, mind map.
 * Each has a JSON schema (so Gemini returns structured data), a prompt, and a
 * normaliser that cleans the output before it reaches the client.
 */

const STUDY_TYPES = ['notes', 'quiz', 'flashcards', 'mindmap'];
// 'student' is the intermediate level (kept as the stored key so existing cached materials still match)
const LEVELS = ['kids', 'beginner', 'student', 'advanced', 'teacher'];
const DEFAULT_LEVEL = 'student';

const S = SchemaType;
const str = (description) => ({ type: S.STRING, ...(description && { description }) });
const TIMESTAMP = str('Where this is covered in the video, copied from the transcript, e.g. "4:32". Empty string if unsure.');

const SCHEMAS = {
    notes: {
        type: S.OBJECT,
        properties: {
            title: str('Short title for the notes'),
            overview: str('2-3 sentence overview'),
            sections: {
                type: S.ARRAY,
                items: {
                    type: S.OBJECT,
                    properties: {
                        heading: str(),
                        timestamp: TIMESTAMP,
                        points: { type: S.ARRAY, items: str('One concise bullet point; **bold** key words') },
                    },
                    required: ['heading', 'timestamp', 'points'],
                },
            },
            keyTerms: {
                type: S.ARRAY,
                items: {
                    type: S.OBJECT,
                    properties: { term: str(), definition: str() },
                    required: ['term', 'definition'],
                },
            },
        },
        required: ['title', 'overview', 'sections', 'keyTerms'],
    },

    quiz: {
        type: S.OBJECT,
        properties: {
            questions: {
                type: S.ARRAY,
                items: {
                    type: S.OBJECT,
                    properties: {
                        question: str(),
                        options: { type: S.ARRAY, items: str(), description: 'Exactly 4 answer options' },
                        answerIndex: { type: S.INTEGER, description: 'Index (0-3) of the correct option' },
                        explanation: str('Why the answer is correct, 1-2 sentences'),
                        timestamp: TIMESTAMP,
                        difficulty: { type: S.STRING, format: 'enum', enum: ['easy', 'medium', 'hard'] },
                    },
                    required: ['question', 'options', 'answerIndex', 'explanation', 'timestamp', 'difficulty'],
                },
            },
        },
        required: ['questions'],
    },

    flashcards: {
        type: S.OBJECT,
        properties: {
            cards: {
                type: S.ARRAY,
                items: {
                    type: S.OBJECT,
                    properties: {
                        front: str('A question or term'),
                        back: str('The answer or definition, short'),
                        timestamp: TIMESTAMP,
                    },
                    required: ['front', 'back', 'timestamp'],
                },
            },
        },
        required: ['cards'],
    },

    mindmap: {
        type: S.OBJECT,
        properties: {
            root: str('The central topic, 1-5 words'),
            branches: {
                type: S.ARRAY,
                items: {
                    type: S.OBJECT,
                    properties: {
                        label: str('Main idea, 1-5 words'),
                        timestamp: TIMESTAMP,
                        children: {
                            type: S.ARRAY,
                            items: {
                                type: S.OBJECT,
                                properties: {
                                    label: str('Sub-idea, 1-6 words'),
                                    details: { type: S.ARRAY, items: str('Detail, 1-6 words') },
                                },
                                required: ['label', 'details'],
                            },
                        },
                    },
                    required: ['label', 'timestamp', 'children'],
                },
            },
        },
        required: ['root', 'branches'],
    },
};

const LEVEL_GUIDANCE = {
    kids: 'The audience is children aged 8-12. Use very simple words, short sentences, friendly tone, and everyday examples. Avoid jargon; if a technical word is needed, explain it simply.',
    beginner: `The audience is students who are new to this subject. ${LEARNER_LEVELS.beginner}`,
    student: 'The audience is high-school or college students preparing for exams. Be clear, accurate and exam-focused.',
    advanced: `The audience is advanced students. ${LEARNER_LEVELS.advanced} Questions and cards should test understanding and application, not just recall.`,
    teacher: 'The audience is a teacher preparing a lesson. Be precise, include the key concepts to teach, common misconceptions, and points suitable for classroom discussion.',
};

const TASKS = {
    notes: 'Create well-organised study notes for this video: a title, a short overview, 4-8 sections in the order the video covers them (each with 2-6 bullet points), and 4-10 key terms with definitions.',
    quiz: 'Create a multiple-choice quiz of 8 questions that checks understanding of the most important ideas in this video. Each question has exactly 4 options with one correct answer. Use 3 easy, 3 medium and 2 hard questions and mark each one\'s difficulty. Make wrong options plausible.',
    flashcards: 'Create 12-16 flashcards covering the key facts, terms and ideas in this video. Front: a question or term. Back: a short answer (under 30 words).',
    mindmap: 'Create a mind map of this video: one central topic, 4-6 main branches in the order the video covers them, each with 2-4 sub-ideas, each sub-idea with 0-3 short details. Keep every label short.',
};

function buildPrompt(type, level, context, language) {
    return `${TASKS[type]}

${LEVEL_GUIDANCE[level]}

Write ALL text in ${languageName(language)}, even if the transcript is in another language.
Base everything only on the video. Timestamps must come from the [m:ss] markers in the transcript.

Video title: ${context.title}

Summary:
${context.summary || '(none)'}

Transcript (each line starts with a [m:ss] timestamp):
${formatTranscript(context.transcript, LIMITS.CHAT_TRANSCRIPT_CHARS)}`;
}

// ------------------------------------------------------------------ normalisers

const clean = (v, max = 1000) => String(v ?? '').trim().slice(0, max);
const cleanTs = (v) => (/^\d{1,2}(:\d{2}){1,2}$/.test(String(v || '').trim()) ? String(v).trim() : '');
const arr = (v) => (Array.isArray(v) ? v : []);

const NORMALISERS = {
    notes: (d) => ({
        title: clean(d.title, 200),
        overview: clean(d.overview, 2000),
        sections: arr(d.sections).map((s) => ({
            heading: clean(s.heading, 200),
            timestamp: cleanTs(s.timestamp),
            points: arr(s.points).map((p) => clean(p, 600)).filter(Boolean),
        })).filter((s) => s.heading && s.points.length),
        keyTerms: arr(d.keyTerms).map((k) => ({ term: clean(k.term, 120), definition: clean(k.definition, 600) }))
            .filter((k) => k.term && k.definition),
    }),

    quiz: (d) => ({
        questions: arr(d.questions).map((q) => {
            const options = arr(q.options).map((o) => clean(o, 300)).filter(Boolean);
            const answerIndex = Number(q.answerIndex);
            return {
                question: clean(q.question, 600),
                options,
                answerIndex,
                explanation: clean(q.explanation, 800),
                timestamp: cleanTs(q.timestamp),
                difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : null,
            };
        }).filter((q) => q.question && q.options.length >= 2 && Number.isInteger(q.answerIndex)
            && q.answerIndex >= 0 && q.answerIndex < q.options.length),
    }),

    flashcards: (d) => ({
        cards: arr(d.cards).map((c) => ({
            front: clean(c.front, 300),
            back: clean(c.back, 600),
            timestamp: cleanTs(c.timestamp),
        })).filter((c) => c.front && c.back),
    }),

    mindmap: (d) => ({
        root: clean(d.root, 80),
        branches: arr(d.branches).map((b) => ({
            label: clean(b.label, 80),
            timestamp: cleanTs(b.timestamp),
            children: arr(b.children).map((c) => ({
                label: clean(c.label, 80),
                details: arr(c.details).map((x) => clean(x, 80)).filter(Boolean).slice(0, 4),
            })).filter((c) => c.label).slice(0, 6),
        })).filter((b) => b.label).slice(0, 8),
    }),
};

const isEmpty = {
    notes: (d) => d.sections.length === 0,
    quiz: (d) => d.questions.length === 0,
    flashcards: (d) => d.cards.length === 0,
    mindmap: (d) => !d.root || d.branches.length === 0,
};

/**
 * Generate one study material with Gemini.
 */
async function generate(type, { context, language, level }) {
    const options = {
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: SCHEMAS[type],
            temperature: type === 'quiz' ? 0.6 : 0.4,
        },
    };

    let raw;
    try {
        raw = await geminiService.withModel(options, async (model) => {
            const result = await model.generateContent(buildPrompt(type, level, context, language));
            return result.response.text();
        });
    } catch (error) {
        throw wrapGeminiError(error, `Failed to create ${type === 'mindmap' ? 'the mind map' : type}. Please try again.`);
    }

    let data;
    try {
        data = NORMALISERS[type](JSON.parse(raw));
    } catch {
        throw new AppError('The AI returned an unexpected format. Please try again.', 502, 'AI_BAD_OUTPUT');
    }
    if (isEmpty[type](data)) {
        throw new AppError('The AI could not create this from the video. Please try again.', 502, 'AI_BAD_OUTPUT');
    }
    return data;
}

module.exports = {
    STUDY_TYPES, LEVELS, DEFAULT_LEVEL, generate, NORMALISERS, buildPrompt,
};
