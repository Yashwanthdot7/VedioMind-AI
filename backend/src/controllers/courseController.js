const courseJobs = require('../services/courseJobs');
const { isSupabaseEnabled } = require('../config/supabase');
const AppError = require('../lib/AppError');
const { readLessonInput } = require('./lessonInput');
const shareService = require('../services/shareService');

/** What the client may see (never the owner's id) */
function publicCourse(course, req) {
    const { userId, shareSlug, ...rest } = course;
    const isOwner = Boolean(userId && req.user?.id === userId);
    return { ...rest, isOwner, shareSlug: isOwner ? shareSlug || null : null };
}

/** Owner-only, except courses made by guests and courses shared with a class link */
async function loadAccessible(req) {
    const course = await courseJobs.get(req.params.id);
    if (!course || (course.userId && course.userId !== req.user?.id && !course.isPublic)) {
        throw new AppError('Course not found', 404, 'NOT_FOUND');
    }
    return course;
}

class CourseController {
    /** POST /api/courses — same body as a lesson, plus { modules: 3-5 } */
    async create(req, res, next) {
        try {
            const { length, ...input } = await readLessonInput(req.body || {}); // eslint-disable-line no-unused-vars
            const course = await courseJobs.create({ userId: req.user?.id, ...input, moduleCount: req.body?.modules });
            res.status(202).json({ success: true, data: publicCourse(await courseJobs.get(course.id), req) });
        } catch (error) {
            next(error);
        }
    }

    /** GET /api/courses — your courses (needs an account) */
    async list(req, res, next) {
        try {
            if (!isSupabaseEnabled || !req.user) return res.json({ success: true, data: [] });
            res.json({ success: true, data: await courseJobs.listForUser(req.user.id) });
        } catch (error) {
            next(error);
        }
    }

    /** GET /api/courses/:id — outline, and every module's status and progress */
    async get(req, res, next) {
        try {
            res.json({ success: true, data: publicCourse(await loadAccessible(req), req) });
        } catch (error) {
            next(error);
        }
    }

    /** POST /api/courses/:id/share  { public: boolean } — owner turns the class link on or off */
    async share(req, res, next) {
        try {
            const course = await loadAccessible(req);
            if (!req.user || course.userId !== req.user.id) {
                throw new AppError('Sign in and open your own course to share it.', 403, 'FORBIDDEN');
            }
            const { isPublic, shareSlug } = await shareService.setShared('course', course, req.body?.public !== false);
            res.json({ success: true, data: { isPublic, shareSlug } });
        } catch (error) {
            next(error);
        }
    }

    /** DELETE /api/courses/:id — the course and all its module lessons */
    async remove(req, res, next) {
        try {
            const course = await loadAccessible(req);
            if (!course.userId) throw new AppError('Only courses saved to an account can be deleted', 403, 'FORBIDDEN');
            // Shared courses are visible to students, but only the owner can delete
            if (course.userId !== req.user?.id) throw new AppError('Only the owner can delete this course.', 403, 'FORBIDDEN');
            await courseJobs.remove(course);
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CourseController();
