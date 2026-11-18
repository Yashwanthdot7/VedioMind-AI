const shareService = require('../services/shareService');
const AppError = require('../lib/AppError');

/** GET /api/shared/:slug — what a class link points to (only while it is public) */
async function resolve(req, res, next) {
    try {
        const hit = await shareService.resolve(req.params.slug);
        if (!hit) throw new AppError('This link has been turned off or does not exist.', 404, 'SHARE_NOT_FOUND');
        res.json({ success: true, data: hit });
    } catch (error) {
        next(error);
    }
}

module.exports = { resolve };
