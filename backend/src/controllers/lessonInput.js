const lessonService = require('../services/lessonService');
const ttsService = require('../services/ttsService');
const { resolveContext } = require('../services/contextResolver');
const AppError = require('../lib/AppError');
const { parseLanguage } = require('../utils/validators');
const { LEVELS, DEFAULT_LEARNER } = require('../config/learner');

const AUDIENCES = ['kids', 'student', 'teacher'];
const MIN_TEXT = 15;
const MAX_TEXT = 100000; // long material is condensed with TextRank, or split into course modules

/**
 * Validates the shared lesson / course request body:
 * { text } or { videoId, analysisId?, videoContext? } + { audience, language, length, voice, visuals }
 */
async function readLessonInput(body, learner = DEFAULT_LEARNER) {
    // Defaults come from the learner's profile: teachers make teacher lessons, students get their level
    const audience = body.audience ?? (learner.role === 'teacher' ? 'teacher' : 'student');
    if (!AUDIENCES.includes(audience)) throw new AppError('Unknown audience', 400, 'INVALID_AUDIENCE');
    const language = parseLanguage(body.language);
    const length = body.length ?? 'short';
    if (!lessonService.LENGTHS[length]) throw new AppError('Unknown length', 400, 'INVALID_LENGTH');
    const voice = body.voice && ttsService.voices()[body.voice] ? body.voice : undefined;
    const visuals = body.visuals === 'slides' ? 'slides' : 'pictures';
    const level = LEVELS.includes(body.level) ? body.level : (learner.role === 'student' ? learner.level : 'intermediate');
    if (body.level !== undefined && !LEVELS.includes(body.level)) throw new AppError('Unknown level', 400, 'INVALID_LEVEL');
    const teacherMode = audience === 'teacher' ? (body.teacherMode === 'class' ? 'class' : 'guide') : null;

    let material;
    let source;
    let sourceVideo = null;
    let inputText = null;

    if (typeof body.text === 'string' && body.text.trim()) {
        inputText = body.text.trim();
        if (inputText.length < MIN_TEXT) {
            throw new AppError('Please write a little more: a topic or a few sentences.', 400, 'TEXT_TOO_SHORT');
        }
        if (inputText.length > MAX_TEXT) {
            throw new AppError(`Text is too long (max ${MAX_TEXT.toLocaleString()} characters).`, 400, 'TEXT_TOO_LONG');
        }
        material = inputText;
        source = 'text';
    } else if (body.videoId || body.analysisId) {
        const context = await resolveContext({ ...body, language: body.videoLanguage || language });
        material = lessonService.materialFromVideo(context);
        source = 'video';
        sourceVideo = {
            videoId: context.videoId || body.videoId,
            analysisId: context.analysisId || null,
            title: context.title,
        };
    } else {
        throw new AppError('Write a topic or some text, or pick a video.', 400, 'NO_INPUT');
    }

    return { material, inputText, source, sourceVideo, audience, language, length, voice, visuals, level, teacherMode };
}

module.exports = { readLessonInput, AUDIENCES, MIN_TEXT, MAX_TEXT };
