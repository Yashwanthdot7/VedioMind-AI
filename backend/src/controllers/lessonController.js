const path = require('path');
const lessonJobs = require('../services/lessonJobs');
const lessonService = require('../services/lessonService');
const ttsService = require('../services/ttsService');
const imageService = require('../services/imageService');
const { isSupabaseEnabled } = require('../config/supabase');
const AppError = require('../lib/AppError');
const { readLessonInput, AUDIENCES } = require('./lessonInput');


/** What the client may see (never the owner's id) */
function publicLesson(lesson) {
    const { userId, inputText, ...rest } = lesson;
    return { ...rest, inputPreview: inputText ? inputText.slice(0, 200) : null };
}

/** Owner-only, except lessons made by guests (no account) which work by link */
async function loadAccessible(req) {
    const lesson = await lessonJobs.get(req.params.id);
    if (!lesson) throw new AppError('Lesson not found', 404, 'NOT_FOUND');
    if (lesson.userId && lesson.userId !== req.user?.id) {
        throw new AppError('Lesson not found', 404, 'NOT_FOUND');
    }
    return lesson;
}

class LessonController {
    /** GET /api/lessons/options — voices, audiences, lengths for the form */
    options(_req, res) {
        res.json({
            success: true,
            data: {
                voices: ttsService.voices(),
                pictures: imageService.enabled(),
                pictureProvider: imageService.cloudflareEnabled() ? 'cloudflare' : (imageService.pollinationsEnabled() ? 'pollinations' : null),
                audiences: AUDIENCES,
                lengths: Object.fromEntries(Object.entries(lessonService.LENGTHS).map(([k, v]) => [k, v.label])),
            },
        });
    }

    /**
     * POST /api/lessons
     * { text } or { videoId, analysisId?, videoContext? } + { audience, language, length, voice }
     */
    async create(req, res, next) {
        try {
            const input = await readLessonInput(req.body || {});
            const lesson = await lessonJobs.create({ userId: req.user?.id, ...input });
            res.status(202).json({ success: true, data: publicLesson(lesson) });
        } catch (error) {
            next(error);
        }
    }

    /** GET /api/lessons — your lessons (needs an account) */
    async list(req, res, next) {
        try {
            if (!isSupabaseEnabled || !req.user) return res.json({ success: true, data: [] });
            const items = await lessonJobs.listForUser(req.user.id);
            res.json({ success: true, data: items });
        } catch (error) {
            next(error);
        }
    }

    /** GET /api/lessons/:id — status while processing, full lesson when done */
    async get(req, res, next) {
        try {
            const lesson = await loadAccessible(req);
            res.json({ success: true, data: publicLesson(lesson) });
        } catch (error) {
            next(error);
        }
    }

    /** GET /api/lessons/:id/audio/:index — narration WAV for one scene */
    async audio(req, res, next) {
        try {
            const lesson = await loadAccessible(req);
            const index = Number(req.params.index);
            if (!Number.isInteger(index) || index < 0 || index >= lesson.scenes.length || !lesson.scenes[index].audio) {
                throw new AppError('Audio not found', 404, 'NOT_FOUND');
            }
            const wav = await lessonJobs.readAudio(lesson.id, index);
            if (!wav) throw new AppError('This lesson\'s audio could not be found. Please create the lesson again.', 404, 'AUDIO_MISSING');
            res.set('Cache-Control', 'private, max-age=86400');
            res.type('audio/wav').send(wav);
        } catch (error) {
            next(error);
        }
    }

    /** GET /api/lessons/:id/image/:index — AI picture for one scene */
    async image(req, res, next) {
        try {
            const lesson = await loadAccessible(req);
            const index = Number(req.params.index);
            const scene = Number.isInteger(index) ? lesson.scenes[index] : null;
            if (!scene || !scene.image) throw new AppError('Picture not found', 404, 'NOT_FOUND');
            const picture = await lessonJobs.readImage(lesson.id, scene.image);
            if (!picture) throw new AppError('This lesson\'s pictures could not be found. Please create the lesson again.', 404, 'IMAGE_MISSING');
            res.set('Cache-Control', 'private, max-age=86400');
            res.type(path.extname(scene.image)).send(picture);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/lessons/:id/quiz  { kind: 'quick' | 'test', refresh? }
     * Quizzes are made only when asked for, so lessons finish faster.
     */
    async quiz(req, res, next) {
        try {
            const lesson = await loadAccessible(req);
            if (lesson.status !== 'done') throw new AppError('The lesson is still being created.', 409, 'NOT_READY');
            const kind = req.body?.kind === 'test' ? 'test' : 'quick';
            const questions = await lessonJobs.ensureQuiz(lesson, kind, { refresh: req.body?.refresh === true });
            res.json({ success: true, data: { kind, questions } });
        } catch (error) {
            next(error);
        }
    }

    /** DELETE /api/lessons/:id */
    async remove(req, res, next) {
        try {
            const lesson = await loadAccessible(req);
            if (!lesson.userId) throw new AppError('Only lessons saved to an account can be deleted', 403, 'FORBIDDEN');
            await lessonJobs.remove(lesson);
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new LessonController();
