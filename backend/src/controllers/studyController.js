const studyService = require('../services/studyService');
const store = require('../services/analysisStore');
const { resolveContext } = require('../services/contextResolver');
const { MemoryCache } = require('../lib/memoryCache');
const AppError = require('../lib/AppError');
const { parseLanguage } = require('../utils/validators');

const studyCache = new MemoryCache({ maxEntries: 200 });
const inFlight = new Map();

class StudyController {
    /**
     * POST /api/study/:type
     * { analysisId?, videoId, language?, level?, refresh?, videoContext? }
     * type: notes | quiz | flashcards | mindmap
     */
    async generate(req, res, next) {
        try {
            const { type } = req.params;
            if (!studyService.STUDY_TYPES.includes(type)) {
                throw new AppError(`Unknown study tool: ${type}`, 404, 'NOT_FOUND');
            }
            const language = parseLanguage(req.body?.language);
            const level = req.body?.level ?? studyService.DEFAULT_LEVEL;
            if (!studyService.LEVELS.includes(level)) {
                throw new AppError(`Unknown level: ${level}`, 400, 'INVALID_LEVEL');
            }
            const refresh = req.body?.refresh === true;

            const context = await resolveContext({ ...req.body, language });
            const videoKey = context.analysisId || context.videoId || req.body?.videoId;
            const key = `${videoKey}:${language}:${level}:${type}`;

            if (!refresh) {
                const cached = studyCache.get(key)
                    || await store.getStudyMaterial(context.analysisId, type, language, level);
                if (cached) {
                    studyCache.set(key, cached);
                    return res.json({ success: true, cached: true, type, level, language, ...cached });
                }
            }

            if (!inFlight.has(key)) {
                inFlight.set(key, (async () => {
                    const data = await studyService.generate(type, { context, language, level });
                    const entry = { data, createdAt: new Date().toISOString() };
                    studyCache.set(key, entry);
                    await store.saveStudyMaterial(context.analysisId, type, language, level, data);
                    return entry;
                })().finally(() => inFlight.delete(key)));
            }
            const entry = await inFlight.get(key);

            res.json({ success: true, cached: false, type, level, language, ...entry });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new StudyController();
