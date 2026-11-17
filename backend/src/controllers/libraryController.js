const store = require('../services/analysisStore');
const AppError = require('../lib/AppError');
const { isUuid } = require('../utils/validators');

function requireAnalysisId(req) {
    const { analysisId } = req.params;
    if (!isUuid(analysisId)) throw new AppError('Invalid video id', 400, 'INVALID_ID');
    return analysisId;
}

async function requireOwned(userId, analysisId) {
    if (!(await store.isInLibrary(userId, analysisId))) {
        throw new AppError('That video is not in your library', 404, 'NOT_FOUND');
    }
}

class LibraryController {
    /** GET /api/library */
    async list(req, res, next) {
        try {
            const items = await store.listLibrary(req.user.id);
            res.json({ success: true, data: items });
        } catch (error) {
            next(error);
        }
    }

    /** GET /api/library/:analysisId — full analysis + saved chat */
    async get(req, res, next) {
        try {
            const analysisId = requireAnalysisId(req);
            await requireOwned(req.user.id, analysisId);
            const [analysis, chat] = await Promise.all([
                store.getAnalysisById(analysisId),
                store.getChatHistory(req.user.id, analysisId),
            ]);
            if (!analysis) throw new AppError('Video not found', 404, 'NOT_FOUND');
            res.json({ success: true, data: { analysis, chat } });
        } catch (error) {
            next(error);
        }
    }

    /** PATCH /api/library/:analysisId  { isFavorite } */
    async update(req, res, next) {
        try {
            const analysisId = requireAnalysisId(req);
            await requireOwned(req.user.id, analysisId);
            await store.setFavorite(req.user.id, analysisId, req.body?.isFavorite);
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    }

    /** DELETE /api/library/:analysisId — removes from library and deletes its chat */
    async remove(req, res, next) {
        try {
            const analysisId = requireAnalysisId(req);
            await store.clearChatHistory(req.user.id, analysisId);
            await store.removeFromLibrary(req.user.id, analysisId);
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    }

    /** DELETE /api/library/:analysisId/chat — clear the conversation only */
    async clearChat(req, res, next) {
        try {
            const analysisId = requireAnalysisId(req);
            await requireOwned(req.user.id, analysisId);
            await store.clearChatHistory(req.user.id, analysisId);
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new LibraryController();
