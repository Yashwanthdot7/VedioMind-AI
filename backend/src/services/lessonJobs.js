const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const lessonService = require('./lessonService');
const ttsService = require('./ttsService');
const imageService = require('./imageService');

/**
 * Video lesson jobs. A lesson is created instantly and processed in the
 * background: script -> narration audio per scene -> done.
 *
 * Files live on the local disk (free): STORAGE/<id>/lesson.json + scene-N.wav
 * Signed-in users also get a row in Supabase generated_videos (metadata only).
 */

const STORAGE = path.resolve(process.env.LESSON_STORAGE_DIR || path.join(__dirname, '../../storage/lessons'));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Voice errors that mean "no free voice right now" -> fall back to the browser's voice
const VOICE_FALLBACK_CODES = new Set(['TTS_QUOTA', 'TTS_UNAVAILABLE', 'TTS_EMPTY']);

const jobs = new Map(); // id -> lesson (in memory while the server runs)
const running = new Map(); // id -> promise that settles when the job finishes

const dirOf = (id) => path.join(STORAGE, id);
const isLessonId = (id) => UUID_RE.test(String(id || ''));

async function writeLesson(lesson) {
    await fs.mkdir(dirOf(lesson.id), { recursive: true });
    await fs.writeFile(path.join(dirOf(lesson.id), 'lesson.json'), JSON.stringify(lesson, null, 2));
}

async function readLesson(id) {
    try {
        return JSON.parse(await fs.readFile(path.join(dirOf(id), 'lesson.json'), 'utf8'));
    } catch {
        return null;
    }
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
            title: lesson.title, voice: lesson.voice, voiceMode: lesson.voiceMode, visuals: lesson.visuals, scenes: lesson.scenes, sourceVideo: lesson.sourceVideo || null,
        },
        quiz: lesson.quiz?.length ? { kind: lesson.quizKind || 'quick', questions: lesson.quiz } : [],
        video_path: dirOf(lesson.id),
        duration_sec: Math.round(lesson.durationSec || 0) || null,
        error: lesson.error || null,
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
    const fromDisk = await readLesson(id);
    if (fromDisk) return fromDisk;
    if (supabase) {
        const { data } = await supabase.from('generated_videos').select('*').eq('id', id).maybeSingle();
        if (data) return lessonFromRow(data);
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
    await fs.rm(dirOf(lesson.id), { recursive: true, force: true });
    if (supabase && lesson.userId) {
        await supabase.from('generated_videos').delete().eq('id', lesson.id).eq('user_id', lesson.userId);
    }
}

function audioPath(id, index) {
    return path.join(dirOf(id), `scene-${index}.wav`);
}

const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function imagePath(id, file) {
    return path.join(dirOf(id), path.basename(file));
}

/** Narration for every scene (sequential: the free voice tier is rate-limited per minute) */
async function narrateScenes(lesson, onProgress) {
    const style = lessonService.AUDIENCE[lesson.audience].voiceStyle;
    for (let i = 0; i < lesson.scenes.length; i += 1) {
        const scene = lesson.scenes[i];
        try {
            const { wav, duration } = await ttsService.synthesize(scene.narration, { voice: lesson.voice, style });
            await fs.writeFile(audioPath(lesson.id, i), wav);
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
            await fs.writeFile(imagePath(lesson.id, file), buffer);
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
            material, context, audience: lesson.audience, language: lesson.language, length: lesson.length,
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
async function create({ userId, material, inputText, source, sourceVideo, audience, language, length, voice, visuals, courseId = null, moduleIndex = null, title = null, context = '' }) {
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

/** Resolves when the lesson's background job has finished (immediately if it isn't running) */
function whenDone(id) {
    return running.get(id) || Promise.resolve();
}

module.exports = {
    create, whenDone, get, listForUser, remove, audioPath, imagePath, isLessonId, ensureQuiz, STORAGE, _jobs: jobs, _runJob: runJob,
};
