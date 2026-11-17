const youtubeService = require('../services/youtubeService');
const geminiService = require('../services/geminiService');
const store = require('../services/analysisStore');
const { extractVideoId, parseLanguage } = require('../utils/validators');

// If two people submit the same video at once, only call Gemini once
const inFlight = new Map();

async function buildAnalysis(videoId, language, userId) {
    const videoInfo = await youtubeService.getVideoInfo(videoId);
    const transcript = await youtubeService.getTranscript(videoId, videoInfo.duration);
    const { summary, keyTakeaways } = await geminiService.analyzeVideo({
        title: videoInfo.title,
        transcript,
        language,
    });

    return store.saveAnalysis({
        videoId,
        language,
        title: videoInfo.title,
        transcript,
        summary,
        keyTakeaways,
        metadata: {
            duration: videoInfo.duration,
            author: videoInfo.author,
            thumbnail: videoInfo.thumbnail,
        },
    }, userId);
}

class VideoController {
    /**
     * POST /api/video/process  { url, language? }
     * Returns transcript + summary + key takeaways. Cached per video + language.
     */
    async processVideo(req, res, next) {
        try {
            const videoId = extractVideoId(req.body?.url);
            const language = parseLanguage(req.body?.language);
            const userId = req.user?.id || null;

            let analysis = await store.findAnalysis(videoId, language);
            const fromCache = Boolean(analysis);

            if (!analysis) {
                const key = `${videoId}:${language}`;
                if (!inFlight.has(key)) {
                    inFlight.set(key, buildAnalysis(videoId, language, userId).finally(() => inFlight.delete(key)));
                }
                analysis = await inFlight.get(key);
            }

            await store.addToLibrary(userId, analysis.analysisId);

            res.json({
                success: true,
                cached: fromCache,
                saved: Boolean(userId && analysis.analysisId),
                data: analysis,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/video/info  { url }
     */
    async getVideoInfo(req, res, next) {
        try {
            const videoId = extractVideoId(req.body?.url);
            const videoInfo = await youtubeService.getVideoInfo(videoId);
            res.json({ success: true, data: videoInfo });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new VideoController();
