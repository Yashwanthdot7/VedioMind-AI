const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const lessonService = require('./lessonService');
const ttsService = require('./ttsService');

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
        script: { title: lesson.title, voice: lesson.voice, voiceMode: lesson.voiceMode, scenes: lesson.scenes, sourceVideo: lesson.sourceVideo || null },
        quiz: lesson.quiz,
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
        source: row.source === 'youtube' ? 'video' : 'text',
        sourceVideo: script.sourceVideo || null,
        scenes: script.scenes || [],
        quiz: row.quiz || [],
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
    return (data || []).map((row) => ({
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

/** Runs in the background after create() has returned */
async function runJob(lesson, material) {
    try {
        lesson.status = 'scripting';
        lesson.progress = 5;
        await save(lesson);

        const script = await lessonService.writeScript({
            material, audience: lesson.audience, language: lesson.language, length: lesson.length,
        });
        lesson.title = script.title || lesson.title;
        lesson.quiz = script.quiz;
        lesson.scenes = script.scenes.map((s) => ({ ...s, audio: null, duration: null }));
        lesson.status = 'voice';
        lesson.progress = 20;
        await save(lesson);

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
            lesson.progress = 20 + Math.round(((i + 1) / lesson.scenes.length) * 78);
            await save(lesson);
        }

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

/**
 * Create a lesson job and start processing in the background.
 * @returns the lesson (status "queued")
 */
async function create({ userId, material, inputText, source, sourceVideo, audience, language, length, voice }) {
    const lesson = {
        id: crypto.randomUUID(),
        userId: userId || null,
        title: sourceVideo?.title ? `Lesson: ${sourceVideo.title}`.slice(0, 100) : 'New lesson',
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
        scenes: [],
        quiz: [],
        durationSec: null,
        error: null,
        createdAt: new Date().toISOString(),
    };
    await save(lesson);
    // Fire and forget; progress is saved as it goes
    setImmediate(() => { runJob(lesson, material); });
    return lesson;
}

module.exports = {
    create, get, listForUser, remove, audioPath, isLessonId, STORAGE, _jobs: jobs, _runJob: runJob,
};
