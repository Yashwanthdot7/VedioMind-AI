const path = require('path');
const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const lessonService = require('./lessonService');
const ttsService = require('./ttsService');
const imageService = require('./imageService');
const files = require('./lessonFiles');

/**
 * Video lesson jobs. A lesson is created instantly and processed in the
 * background: script -> narration audio per scene -> done.
 *
 * Files: <id>/lesson.json + scene-N.wav + scene-N.jpg, on disk and (when Supabase is
 * set up) in a Supabase Storage bucket so they survive restarts on free hosts.
 * Signed-in users also get a row in Supabase generated_videos (metadata only).
 */

const { STORAGE } = files;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Voice errors that mean "no free voice right now" -> fall back to the browser's voice
const VOICE_FALLBACK_CODES = new Set(['TTS_QUOTA', 'TTS_UNAVAILABLE', 'TTS_EMPTY']);

const jobs = new Map(); // id -> lesson (in memory while the server runs)
const running = new Map(); // id -> promise that settles when the job finishes

const dirOf = files.dirOf;
const isLessonId = (id) => UUID_RE.test(String(id || ''));

const FINISHED = new Set(['done', 'failed']);

async function writeLesson(lesson) {
    const json = JSON.stringify(lesson, null, 2);
    // Progress ticks only need the local copy; finished lessons are also kept in the cloud
    if (FINISHED.has(lesson.status)) await files.put(lesson.id, 'lesson.json', json);
    else await files.putLocal(lesson.id, 'lesson.json', json);
}

async function readLesson(id) {
    const buffer = await files.read(id, 'lesson.json');
    if (!buffer) return null;
    try {
        return JSON.parse(buffer.toString('utf8'));
    } catch {
        return null;
    }
}

/** A lesson still "in progress" that this server isn't working on was cut off by a restart */
function markInterrupted(lesson) {
    if (!lesson || FINISHED.has(lesson.status) || jobs.has(lesson.id)) return lesson;
    return {
        ...lesson,
        status: 'failed',
        error: 'The server restarted while this lesson was being made. Please create it again.',
    };
}

const DB_AUDIENCE = { kids: 'kid', student: 'student', teacher: 'teacher' };
const FROM_DB_AUDIENCE = { kid: 'kids', student: 'student', teacher: 'teacher', other: 'student' };

async function syncToDb(lesson) {
    if (!supabase || !lesson.userId) return;
    const { error } = await supabase.from('generated_videos').upsert({
        id: lesson.id,
        user_id: lesson.userId,
        source: lesson.source === 'video' ? 'youtube' : 'text',
        analysis_id: lesson.sourceVideo?.analysisId || null,
        input_text: lesson.inputText ? lesson.inputText.slice(0, 20000) : null,
        audience: DB_AUDIENCE[lesson.audience] || 'student',
        language: lesson.language,
        status: lesson.status,
        progress: lesson.progress,
        script: {
            courseId: lesson.courseId || null, moduleIndex: lesson.moduleIndex ?? null,
            level: lesson.level || 'intermediate', teacherMode: lesson.teacherMode || null, teacherPlan: lesson.teacherPlan || null,
            title: lesson.title, voice: lesson.voice, voiceMode: lesson.voiceMode, visuals: lesson.visuals, scenes: lesson.scenes, sourceVideo: lesson.sourceVideo || null,
        },
        quiz: lesson.quiz?.length ? { kind: lesson.quizKind || 'quick', questions: lesson.quiz } : [],
        video_path: `${files.BUCKET}/${lesson.id}`,
        duration_sec: Math.round(lesson.durationSec || 0) || null,
        error: lesson.error || null,
        is_public: Boolean(lesson.isPublic),
        share_slug: lesson.shareSlug || null,
    }, { onConflict: 'id' });
    if (error) console.warn('Saving lesson to Supabase failed:', error.message);
}

async function save(lesson) {
    lesson.updatedAt = new Date().toISOString();
    jobs.set(lesson.id, lesson);
    await writeLesson(lesson);
    await syncToDb(lesson);
}

function lessonFromRow(row) {
    const script = row.script || {};
    return {
        id: row.id,
        userId: row.user_id,
        title: script.title || 'Untitled lesson',
        status: row.status,
        progress: row.progress,
        language: row.language,
        audience: FROM_DB_AUDIENCE[row.audience] || 'student',
        voice: script.voice,
        voiceMode: script.voiceMode || 'gemini',
        visuals: script.visuals || 'slides',
        source: row.source === 'youtube' ? 'video' : 'text',
        sourceVideo: script.sourceVideo || null,
        isPublic: Boolean(row.is_public),
        shareSlug: row.share_slug || null,
        level: script.level || 'intermediate',
        teacherMode: script.teacherMode || null,
        teacherPlan: script.teacherPlan || null,
        courseId: script.courseId || null,
        moduleIndex: script.moduleIndex ?? null,
        scenes: script.scenes || [],
        quiz: Array.isArray(row.quiz) ? row.quiz : (row.quiz?.questions || []),
        quizKind: Array.isArray(row.quiz) ? (row.quiz.length ? 'quick' : null) : (row.quiz?.kind || null),
        durationSec: row.duration_sec,
        error: row.error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function get(id) {
    if (!isLessonId(id)) return null;
    if (jobs.has(id)) return jobs.get(id);
    const saved = await readLesson(id);
    if (saved) return markInterrupted(saved);
    if (supabase) {
        const { data } = await supabase.from('generated_videos').select('*').eq('id', id).maybeSingle();
        if (data) return markInterrupted(lessonFromRow(data));
    }
    return null;
}

async function listForUser(userId) {
    const { data, error } = await supabase
        .from('generated_videos')
        .select('id, status, progress, language, audience, duration_sec, created_at, script')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
    if (error) throw error;
    // Course modules are listed under their course, not as separate lessons
    return (data || []).filter((row) => !row.script?.courseId).map((row) => ({
        id: row.id,
        title: row.script?.title || 'Untitled lesson',
        icon: row.script?.scenes?.[0]?.icon || '🎬',
        status: row.status,
        progress: row.progress,
        language: row.language,
        audience: FROM_DB_AUDIENCE[row.audience] || 'student',
        durationSec: row.duration_sec,
        createdAt: row.created_at,
    }));
}

async function remove(lesson) {
    jobs.delete(lesson.id);
    await files.removeAll(lesson.id);
    if (supabase && lesson.userId) {
        await supabase.from('generated_videos').delete().eq('id', lesson.id).eq('user_id', lesson.userId);
    }
}

const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** @returns {Promise<Buffer|null>} narration WAV for one scene */
const readAudio = (id, index) => files.read(id, `scene-${index}.wav`);
/** @returns {Promise<Buffer|null>} picture for one scene */
const readImage = (id, file) => files.read(id, path.basename(file));

/** Narration for every scene (sequential: the free voice tier is rate-limited per minute) */
async function narrateScenes(lesson, onProgress) {
    const style = lessonService.audienceFor(lesson).voiceStyle;
    for (let i = 0; i < lesson.scenes.length; i += 1) {
        const scene = lesson.scenes[i];
        try {
            const { wav, duration } = await ttsService.synthesize(scene.narration, { voice: lesson.voice, style });
            await files.put(lesson.id, `scene-${i}.wav`, wav);
            scene.audio = `scene-${i}.wav`;
            scene.duration = Math.round(duration * 100) / 100;
        } catch (error) {
            if (!VOICE_FALLBACK_CODES.has(error.code)) throw error;
            // Free voice not available right now: the player will use the browser's voice instead
            console.warn(`Gemini voice unavailable (${error.code}); lesson ${lesson.id} will use the browser voice`);
            lesson.voiceMode = 'browser';
            lesson.voiceNotice = error.code === 'TTS_QUOTA'
                ? 'The free AI voice limit was reached, so this lesson uses your browser\'s voice.'
                : 'The AI voice was unavailable, so this lesson uses your browser\'s voice.';
            lesson.scenes.forEach((s) => { if (!s.audio) s.duration = null; });
            break;
        }
        await onProgress();
    }
}

/** A picture for every scene. Failures never fail the lesson: that scene shows the drawn slide. */
async function illustrateScenes(lesson, onProgress) {
    let failures = 0;
    for (let i = 0; i < lesson.scenes.length; i += 1) {
        const scene = lesson.scenes[i];
        if (!scene.imagePrompt) {
            scene.imageStatus = 'skipped';
            await onProgress();
            continue;
        }
        try {
            const { buffer, mime, provider } = await imageService.generate(scene.imagePrompt, {
                audience: lesson.audience,
                seed: (parseInt(lesson.id.slice(0, 6), 16) + i) % 1000000,
            });
            const file = `scene-${i}.${IMAGE_EXT[mime] || 'jpg'}`;
            await files.put(lesson.id, file, buffer);
            scene.image = file;
            scene.imageStatus = 'done';
            lesson.imageProvider = lesson.imageProvider || provider;
        } catch (error) {
            failures += 1;
            scene.imageStatus = 'failed';
            console.warn(`Picture for scene ${i} of lesson ${lesson.id} failed: ${error.message}`);
        }
        await onProgress();
    }
    if (failures === lesson.scenes.length) {
        lesson.imageNotice = 'The free picture service was busy, so this lesson uses illustrated slides instead.';
    } else if (failures > 0) {
        lesson.imageNotice = `${failures} scene${failures === 1 ? '' : 's'} use${failures === 1 ? 's' : ''} an illustrated slide because the free picture service was busy.`;
    }
}

/** Runs in the background after create() has returned */
async function runJob(lesson, material, context = '') {
    try {
        lesson.status = 'scripting';
        lesson.progress = 5;
        await save(lesson);

        const script = await lessonService.writeScript({
            material, context, audience: lesson.audience, language: lesson.language, length: lesson.length, level: lesson.level, teacherMode: lesson.teacherMode,
        });
        if (!lesson.courseId) lesson.title = script.title || lesson.title; // modules keep the course outline title
        lesson.quiz = []; // made on demand, only if the viewer asks for it
        lesson.planning = script.planning || null;
        const wantPictures = lesson.visuals === 'pictures' && imageService.enabled();
        lesson.scenes = script.scenes.map((s) => ({
            ...s, audio: null, duration: null, image: null, imageStatus: wantPictures ? 'pending' : 'skipped',
        }));
        lesson.status = 'voice';
        lesson.progress = 15;
        await save(lesson);

        // Pictures and narration are made at the same time; progress counts both
        const total = lesson.scenes.length * (wantPictures ? 2 : 1);
        let finished = 0;
        let saving = Promise.resolve();
        const tick = () => {
            finished += 1;
            lesson.progress = 15 + Math.round((finished / total) * 83);
            saving = saving.then(() => save(lesson)).catch(() => {});
            return saving;
        };

        await Promise.all([
            narrateScenes(lesson, tick),
            wantPictures ? illustrateScenes(lesson, tick) : Promise.resolve(),
        ]);
        await saving;

        lesson.durationSec = lesson.scenes.reduce((sum, s) => sum + (s.duration || 0), 0) || null;
        lesson.status = 'done';
        lesson.progress = 100;
        await save(lesson);
        console.log(`Lesson ${lesson.id} ready: ${lesson.scenes.length} scenes, voice=${lesson.voiceMode}`);
    } catch (error) {
        console.error(`Lesson ${lesson.id} failed:`, error.message);
        lesson.status = 'failed';
        lesson.error = error.message || 'Something went wrong while creating the lesson.';
        await save(lesson).catch(() => {});
    }
}

/** Generate (or return the saved) teacher's lesson plan for a finished lesson */
const planInFlight = new Map();
async function ensurePlan(lesson, { refresh = false } = {}) {
    if (!refresh && lesson.teacherPlan) return lesson.teacherPlan;
    if (!planInFlight.has(lesson.id)) {
        planInFlight.set(lesson.id, (async () => {
            lesson.teacherPlan = await lessonService.writeTeacherPlan(lesson);
            await save(lesson);
            return lesson.teacherPlan;
        })().finally(() => planInFlight.delete(lesson.id)));
    }
    return planInFlight.get(lesson.id);
}

/** Generate (or return the saved) quiz/test for a finished lesson */
const quizInFlight = new Map();
async function ensureQuiz(lesson, kind, { refresh = false } = {}) {
    if (!refresh && lesson.quiz?.length && lesson.quizKind === kind) return lesson.quiz;
    const key = `${lesson.id}:${kind}`;
    if (!quizInFlight.has(key)) {
        quizInFlight.set(key, (async () => {
            const questions = await lessonService.writeQuiz(lesson, kind);
            lesson.quiz = questions;
            lesson.quizKind = kind;
            await save(lesson);
            return questions;
        })().finally(() => quizInFlight.delete(key)));
    }
    return quizInFlight.get(key);
}

/**
 * Create a lesson job and start processing in the background.
 * @returns the lesson (status "queued")
 */
async function create({ userId, material, inputText, source, sourceVideo, audience, language, length, voice, visuals, courseId = null, moduleIndex = null, title = null, context = '', isPublic = false, level = 'intermediate', teacherMode = null }) {
    const lesson = {
        id: crypto.randomUUID(),
        userId: userId || null,
        title: title || (sourceVideo?.title ? `Lesson: ${sourceVideo.title}`.slice(0, 100) : 'New lesson'),
        courseId,
        moduleIndex,
        status: 'queued',
        progress: 0,
        source,
        sourceVideo: sourceVideo || null,
        inputText: inputText || null,
        audience,
        language,
        length,
        voice: voice || ttsService.defaultVoice(audience),
        voiceMode: 'gemini',
        voiceNotice: null,
        isPublic: Boolean(isPublic),
        shareSlug: null,
        level,
        teacherMode,
        teacherPlan: null,
        visuals: visuals === 'slides' ? 'slides' : 'pictures',
        imageProvider: null,
        imageNotice: null,
        scenes: [],
        quiz: [],
        durationSec: null,
        error: null,
        createdAt: new Date().toISOString(),
    };
    await save(lesson);
    // Fire and forget; progress is saved as it goes
    const done = new Promise((resolve) => {
        setImmediate(() => { runJob(lesson, material, context).then(resolve, resolve); });
    }).finally(() => running.delete(lesson.id));
    running.set(lesson.id, done);
    return lesson;
}

/** Turn the class link on or off (the slug is kept so a re-shared link still works) */
async function setSharing(lesson, { isPublic, shareSlug }) {
    lesson.isPublic = Boolean(isPublic);
    if (shareSlug) lesson.shareSlug = shareSlug;
    await save(lesson);
    return lesson;
}

/** Resolves when the lesson's background job has finished (immediately if it isn't running) */
function whenDone(id) {
    return running.get(id) || Promise.resolve();
}

module.exports = {
    create, whenDone, setSharing, get, listForUser, remove, readAudio, readImage, isLessonId, ensureQuiz, ensurePlan, STORAGE, _jobs: jobs, _runJob: runJob,
};
