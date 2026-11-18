const { supabase } = require('../config/supabase');
const AppError = require('../lib/AppError');
const { gradeFor } = require('../lib/grades');
const { isUuid, parseLanguage } = require('../utils/validators');

const KINDS = ['quiz', 'quick', 'test'];
const SOURCES = ['study', 'lesson'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const MAX_QUESTIONS = 50;

const COLUMNS = 'id, source, analysis_id, lesson_id, video_id, title, kind, level, language, total, correct, score_pct, grade, duration_sec, answers, created_at';

function dbError(error) {
    if (error?.code === '42P01' || /quiz_attempts/.test(error?.message || '') && /does not exist|schema cache/.test(error?.message || '')) {
        return new AppError('Quiz history isn\'t set up yet: run supabase/migrations/002_quiz_attempts.sql in the Supabase SQL Editor.', 501, 'MIGRATION_NEEDED');
    }
    console.error('Quiz attempts DB error:', error?.message);
    return new AppError('Database error while saving quiz history', 500, 'DB_ERROR');
}

const toClient = (row) => ({
    id: row.id,
    source: row.source,
    analysisId: row.analysis_id,
    lessonId: row.lesson_id,
    videoId: row.video_id,
    title: row.title,
    kind: row.kind,
    level: row.level,
    language: row.language,
    total: row.total,
    correct: row.correct,
    scorePct: row.score_pct,
    grade: row.grade,
    durationSec: row.duration_sec,
    answers: row.answers || [],
    createdAt: row.created_at,
});

/** Validate an attempt; score and grade are always computed here, never trusted from the client */
function parseAttempt(body) {
    const b = body || {};
    if (!SOURCES.includes(b.source)) throw new AppError('Invalid source', 400, 'INVALID_ATTEMPT');
    if (!KINDS.includes(b.kind)) throw new AppError('Invalid quiz kind', 400, 'INVALID_ATTEMPT');
    const title = typeof b.title === 'string' ? b.title.trim().slice(0, 200) : '';
    if (!title) throw new AppError('Title is required', 400, 'INVALID_ATTEMPT');
    if (!Array.isArray(b.answers) || b.answers.length === 0 || b.answers.length > MAX_QUESTIONS) {
        throw new AppError('Answers are required', 400, 'INVALID_ATTEMPT');
    }

    const answers = b.answers.map((a) => {
        const chosen = Number(a?.chosen);
        const answer = Number(a?.answer);
        if (!Number.isInteger(chosen) || !Number.isInteger(answer) || chosen < 0 || answer < 0 || chosen > 9 || answer > 9) {
            throw new AppError('Invalid answer', 400, 'INVALID_ATTEMPT');
        }
        return {
            question: String(a.question || '').slice(0, 400),
            chosen,
            answer,
            correct: chosen === answer,
            difficulty: DIFFICULTIES.includes(a.difficulty) ? a.difficulty : null,
            // Kept so a wrong answer can be retried later ("Review my mistakes")
            ...(Array.isArray(a.options) && a.options.length >= 2 && a.options.length <= 6 && {
                options: a.options.map((o) => String(o ?? '').slice(0, 200)),
            }),
            ...(a.explanation && { explanation: String(a.explanation).slice(0, 600) }),
        };
    });
    const total = answers.length;
    const correct = answers.filter((a) => a.correct).length;
    const scorePct = Math.round((correct / total) * 100);
    const duration = Number(b.durationSec);

    return {
        source: b.source,
        analysis_id: isUuid(b.analysisId) ? b.analysisId : null,
        lesson_id: isUuid(b.lessonId) ? b.lessonId : null,
        video_id: typeof b.videoId === 'string' && /^[\w-]{11}$/.test(b.videoId) ? b.videoId : null,
        title,
        kind: b.kind,
        level: typeof b.level === 'string' ? b.level.slice(0, 20) : null,
        language: parseLanguage(b.language),
        total,
        correct,
        score_pct: scorePct,
        grade: gradeFor(scorePct),
        duration_sec: Number.isFinite(duration) && duration >= 0 ? Math.min(Math.round(duration), 86400) : null,
        answers,
    };
}

class AttemptController {
    /** POST /api/quiz-attempts */
    async create(req, res, next) {
        try {
            const attempt = parseAttempt(req.body);
            const { data, error } = await supabase
                .from('quiz_attempts')
                .insert({ ...attempt, user_id: req.user.id })
                .select(COLUMNS)
                .single();
            if (error) throw dbError(error);
            res.status(201).json({ success: true, data: toClient(data) });
        } catch (error) {
            next(error);
        }
    }

    /** GET /api/quiz-attempts — newest first */
    async list(req, res, next) {
        try {
            const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);
            const { data, error } = await supabase
                .from('quiz_attempts')
                .select(COLUMNS)
                .eq('user_id', req.user.id)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw dbError(error);
            res.json({ success: true, data: (data || []).map(toClient) });
        } catch (error) {
            next(error);
        }
    }

    /** DELETE /api/quiz-attempts/:id */
    async remove(req, res, next) {
        try {
            if (!isUuid(req.params.id)) throw new AppError('Invalid id', 400, 'INVALID_ID');
            const { error } = await supabase.from('quiz_attempts').delete().eq('id', req.params.id).eq('user_id', req.user.id);
            if (error) throw dbError(error);
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    }

    /** DELETE /api/quiz-attempts — clear all history */
    async clear(req, res, next) {
        try {
            const { error } = await supabase.from('quiz_attempts').delete().eq('user_id', req.user.id);
            if (error) throw dbError(error);
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AttemptController();
module.exports.parseAttempt = parseAttempt;
