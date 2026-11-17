const store = require('./analysisStore');
const AppError = require('../lib/AppError');
const { isUuid } = require('../utils/validators');

const MAX_CONTEXT_TRANSCRIPT_ITEMS = 5000;

/**
 * Find the video the user is chatting about:
 * 1. by analysisId (Supabase), 2. by videoId + language (memory cache / Supabase),
 * 3. by a videoContext the client sent (used after a server restart in guest mode).
 */
async function resolveContext({ analysisId, videoId, language, videoContext }) {
    if (isUuid(analysisId)) {
        const found = await store.getAnalysisById(analysisId);
        if (found) return found;
    }
    if (typeof videoId === 'string' && /^[\w-]{11}$/.test(videoId)) {
        const found = await store.findAnalysis(videoId, language);
        if (found) return found;
    }
    if (videoContext && typeof videoContext.title === 'string') {
        const transcript = Array.isArray(videoContext.transcript)
            ? videoContext.transcript.slice(0, MAX_CONTEXT_TRANSCRIPT_ITEMS)
            : String(videoContext.transcript || '');
        return {
            analysisId: null,
            videoId: typeof videoId === 'string' ? videoId : null,
            language,
            title: videoContext.title.slice(0, 500),
            summary: String(videoContext.summary || '').slice(0, 20000),
            transcript,
        };
    }
    throw new AppError(
        'This video\'s context has expired on the server. Resending it…',
        410,
        'CONTEXT_EXPIRED',
    );
}

module.exports = { resolveContext };
