const courseJobs = require('../services/courseJobs');
const { isSupabaseEnabled } = require('../config/supabase');
const AppError = require('../lib/AppError');
const { readLessonInput } = require('./lessonInput');

/** What the client may see (never the owner's id) */
function publicCourse(course) {
    const { userId, ...rest } = course;
    return rest;
}

/** Owner-only, except courses made by guests, which work by link */
async function loadAccessible(req) {
    const course = await courseJobs.get(req.params.id);
    if (!course || (course.userId && course.userId !== req.user?.id)) {
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
            res.status(202).json({ success: true, data: publicCourse(await courseJobs.get(course.id)) });
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
            res.json({ success: true, data: publicCourse(await loadAccessible(req)) });
        } catch (error) {
            next(error);
        }
    }

    /** DELETE /api/courses/:id — the course and all its module lessons */
    async remove(req, res, next) {
        try {
            const course = await loadAccessible(req);
            if (!course.userId) throw new AppError('Only courses saved to an account can be deleted', 403, 'FORBIDDEN');
            await courseJobs.remove(course);
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CourseController();
