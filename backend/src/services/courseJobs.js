const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const files = require('./lessonFiles');
const lessonJobs = require('./lessonJobs');
const courseService = require('./courseService');

/**
 * Course jobs. A course is planned first (outline), then its modules are made one
 * after another as ordinary lessons, so module 1 can be watched while the rest are
 * still being made, and the free API limits are never hit all at once.
 *
 * Files: <courseId>/course.json (same storage as lessons).
 * Signed-in users also get a row in Supabase `courses` (migration 003).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINISHED = new Set(['done', 'failed']);
const courses = new Map(); // id -> course while this server runs
const running = new Map(); // id -> promise that settles when the course is finished

const isCourseId = (id) => UUID_RE.test(String(id || ''));

let tableMissingWarned = false;
async function syncToDb(course) {
    if (!supabase || !course.userId) return;
    const { error } = await supabase.from('courses').upsert({
        id: course.id,
        user_id: course.userId,
        title: course.title,
        language: course.language,
        audience: course.audience,
        status: course.status,
        modules: course.modules,
        error: course.error,
        is_public: Boolean(course.isPublic),
        share_slug: course.shareSlug || null,
    }, { onConflict: 'id' });
    if (error && !tableMissingWarned) {
        tableMissingWarned = true;
        console.warn(`Saving course to Supabase failed (${error.message}). Run supabase/migrations/003_courses.sql to keep courses in accounts.`);
    }
}

async function save(course) {
    course.updatedAt = new Date().toISOString();
    courses.set(course.id, course);
    await files.put(course.id, 'course.json', JSON.stringify(course, null, 2));
    await syncToDb(course);
}

function fromRow(row) {
    return {
        id: row.id, userId: row.user_id, title: row.title, language: row.language, audience: row.audience,
        status: row.status, modules: row.modules || [], error: row.error, isPublic: Boolean(row.is_public), shareSlug: row.share_slug || null,
        createdAt: row.created_at, updatedAt: row.updated_at,
    };
}

async function load(id) {
    if (courses.has(id)) return courses.get(id);
    const buffer = await files.read(id, 'course.json');
    if (buffer) {
        try { return JSON.parse(buffer.toString('utf8')); } catch { /* fall through */ }
    }
    if (supabase) {
        const { data } = await supabase.from('courses').select('*').eq('id', id).maybeSingle();
        if (data) return fromRow(data);
    }
    return null;
}

/**
 * The course with each module's live status and progress, and overall progress.
 * Outline = 10%, each module an equal share of the rest.
 */
async function get(id) {
    if (!isCourseId(id)) return null;
    const course = await load(id);
    if (!course) return null;
    const modules = await Promise.all(course.modules.map(async (m) => {
        if (!m.lessonId) return { ...m, status: 'waiting', progress: 0, icon: null };
        const lesson = await lessonJobs.get(m.lessonId);
        return {
            ...m,
            status: lesson?.status || 'failed',
            progress: lesson?.progress ?? 0,
            icon: lesson?.scenes?.[0]?.icon || null,
            durationSec: lesson?.durationSec || null,
        };
    }));
    const share = modules.length ? 90 / modules.length : 0;
    const progress = course.status === 'outlining' || course.status === 'queued'
        ? 5
        : Math.min(100, Math.round(10 + modules.reduce((sum, m) => sum + (FINISHED.has(m.status) ? share : (m.progress / 100) * share), 0)));

    // Cut off by a restart: this server isn't running it any more
    let { status, error } = course;
    if (!FINISHED.has(status) && !courses.has(id)) {
        status = modules.some((m) => m.status === 'done') ? 'done' : 'failed';
        error = error || 'The server restarted while this course was being made. Finished modules are kept.';
    }
    return { ...course, status, error, progress: status === 'done' ? 100 : progress, modules };
}

async function listForUser(userId) {
    const { data, error } = await supabase.from('courses')
        .select('id, title, language, audience, status, modules, created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (error) {
        if (/relation .* does not exist|could not find the table/i.test(error.message)) return [];
        throw error;
    }
    return (data || []).map((row) => ({
        id: row.id, title: row.title, language: row.language, audience: row.audience, status: row.status,
        moduleCount: (row.modules || []).length, createdAt: row.created_at,
    }));
}

async function remove(course) {
    for (const m of course.modules) {
        if (!m.lessonId) continue;
        const lesson = await lessonJobs.get(m.lessonId);
        if (lesson) await lessonJobs.remove(lesson);
    }
    courses.delete(course.id);
    await files.removeAll(course.id);
    if (supabase && course.userId) {
        await supabase.from('courses').delete().eq('id', course.id).eq('user_id', course.userId);
    }
}

async function run(course, material, options) {
    try {
        course.status = 'outlining';
        await save(course);
        const plan = await courseService.outline({
            material, audience: course.audience, language: course.language, moduleCount: course.moduleCount, level: course.level, teacherMode: course.teacherMode,
        });
        course.title = plan.title;
        course.modules = plan.modules.map((m, index) => ({ index, ...m, lessonId: null }));
        course.status = 'building';
        await save(course);

        const parts = courseService.splitMaterial(material, course.modules);
        let made = 0;
        for (let index = 0; index < course.modules.length; index += 1) {
            const lesson = await lessonJobs.create({
                ...options,
                userId: course.userId,
                material: parts[index],
                context: courseService.moduleContext({ course, index }),
                title: course.modules[index].title,
                courseId: course.id,
                moduleIndex: index,
                length: 'short',
                isPublic: course.isPublic,
            });
            course.modules[index].lessonId = lesson.id;
            await save(course);
            await lessonJobs.whenDone(lesson.id);
            const finished = await lessonJobs.get(lesson.id);
            if (finished?.status === 'done') made += 1;
        }

        course.status = made > 0 ? 'done' : 'failed';
        if (made === 0) course.error = 'None of the modules could be made. Please try again later.';
        else if (made < course.modules.length) course.error = `${course.modules.length - made} module(s) could not be made.`;
        await save(course);
        console.log(`Course ${course.id} ready: ${made}/${course.modules.length} modules`);
    } catch (error) {
        console.error(`Course ${course.id} failed:`, error.message);
        course.status = 'failed';
        course.error = error.message || 'Something went wrong while creating the course.';
        await save(course).catch(() => {});
    }
}

/**
 * @param {object} input  userId, material, source, sourceVideo, inputText, audience, language, voice, visuals, moduleCount
 * @returns the course (status "queued"), made in the background
 */
async function create({ userId, material, source, sourceVideo, inputText, audience, language, voice, visuals, moduleCount, level = 'intermediate', teacherMode = null }) {
    const course = {
        id: crypto.randomUUID(),
        userId: userId || null,
        title: sourceVideo?.title ? `Course: ${sourceVideo.title}`.slice(0, 100) : 'New course',
        status: 'queued',
        language,
        audience,
        moduleCount: courseService.clampModules(moduleCount),
        level,
        teacherMode,
        isPublic: false,
        shareSlug: null,
        modules: [],
        error: null,
        createdAt: new Date().toISOString(),
    };
    await save(course);
    const done = new Promise((resolve) => {
        setImmediate(() => {
            run(course, material, { source, sourceVideo, inputText, audience, language, voice, visuals, level, teacherMode }).then(resolve, resolve);
        });
    }).finally(() => running.delete(course.id));
    running.set(course.id, done);
    return course;
}

/**
 * Turn the class link on or off. Module lessons follow the course, so students can
 * play every module; modules made later inherit the setting.
 */
async function setSharing(course, { isPublic, shareSlug }) {
    const stored = (await load(course.id)) || course;
    stored.isPublic = Boolean(isPublic);
    if (shareSlug) stored.shareSlug = shareSlug;
    await save(stored);
    for (const m of stored.modules) {
        if (!m.lessonId) continue;
        const lesson = await lessonJobs.get(m.lessonId);
        if (lesson) await lessonJobs.setSharing(lesson, { isPublic: stored.isPublic });
    }
    return get(stored.id);
}

/** Resolves when the course's background job has finished */
const whenDone = (id) => running.get(id) || Promise.resolve();

module.exports = { create, whenDone, setSharing, get, listForUser, remove, isCourseId, _courses: courses };
