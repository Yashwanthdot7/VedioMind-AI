const youtubeService = require('../services/youtubeService');
const geminiService = require('../services/geminiService');
const store = require('../services/analysisStore');
const summaryService = require('../services/summaryService');
const { resolveContext } = require('../services/contextResolver');
const { LEVELS } = require('../config/learner');
const AppError = require('../lib/AppError');
const { LIMITS } = require('../types/constants');
const { extractVideoId, parseLanguage } = require('../utils/validators');

/**
 * Captions first (free and exact). If YouTube won't give us captions,
 * let Gemini watch the video and transcribe it.
 */
async function getTranscriptWithFallback(videoId, videoInfo) {
    try {
        return await youtubeService.getTranscript(videoId);
    } catch (error) {
        if (error.code !== 'NO_TRANSCRIPT') throw error;
    }

    if (videoInfo.duration && videoInfo.duration > LIMITS.AI_TRANSCRIBE_MAX_SECONDS) {
        throw new AppError(
            `Captions aren't available and this video is too long for AI transcription (max ${LIMITS.AI_TRANSCRIBE_MAX_SECONDS / 60} minutes).`,
            422,
            'NO_TRANSCRIPT',
        );
    }

    console.log(`No captions for ${videoId}; asking Gemini to transcribe the video`);
    const lines = await geminiService.transcribeYouTube(videoId);
    if (lines.length === 0) {
        throw new AppError('Could not get a transcript for this video, even with AI. Try another video.', 422, 'NO_TRANSCRIPT');
    }
    return youtubeService.mergeSegments(lines);
}

// If two people submit the same video at once, only call Gemini once
const inFlight = new Map();

async function buildAnalysis(videoId, language, userId) {
    const videoInfo = await youtubeService.getVideoInfo(videoId);
    const transcript = await getTranscriptWithFallback(videoId, videoInfo);
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

            // Students who aren't intermediate get the summary at their level
            let data = { ...analysis, level: 'intermediate' };
            const { role, level } = req.learner || {};
            if (role === 'student' && level && level !== 'intermediate') {
                try {
                    data = { ...data, ...(await summaryService.forLevel({ context: analysis, level, language })) };
                } catch (error) {
                    console.warn(`Summary for ${level} failed, showing the standard one:`, error.message);
                    data.levelNotice = 'The summary couldn\'t be adapted to your level right now, so this is the standard one.';
                }
            }

            res.json({
                success: true,
                cached: fromCache,
                saved: Boolean(userId && analysis.analysisId),
                data,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/video/summary  { videoId, analysisId?, language, level, videoContext? }
     * The summary and key takeaways rewritten for a beginner, intermediate or advanced learner.
     */
    async summaryForLevel(req, res, next) {
        try {
            const level = req.body?.level;
            if (!LEVELS.includes(level)) throw new AppError('Choose beginner, intermediate or advanced.', 400, 'INVALID_LEVEL');
            const language = parseLanguage(req.body?.language);
            const context = await resolveContext({ ...req.body, language });
            res.json({ success: true, data: await summaryService.forLevel({ context, level, language }) });
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
