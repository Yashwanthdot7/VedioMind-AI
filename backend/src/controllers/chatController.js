const geminiService = require('../services/geminiService');
const store = require('../services/analysisStore');
const { isSupabaseEnabled } = require('../config/supabase');
const AppError = require('../lib/AppError');
const { parseLanguage, parseMessages, isUuid, MAX_QUESTION_LENGTH } = require('../utils/validators');

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

class ChatController {
    /**
     * POST /api/chat/conversation
     * { messages: [{role, content}], analysisId?, videoId?, language?, videoContext? }
     */
    async conversation(req, res, next) {
        try {
            const messages = parseMessages(req.body?.messages);
            const language = parseLanguage(req.body?.language);
            const context = await resolveContext({ ...req.body, language });

            const answer = await geminiService.chat({ messages, context, language });

            let sessionId = null;
            if (req.user && isSupabaseEnabled && context.analysisId) {
                try {
                    sessionId = await store.getOrCreateSession(req.user.id, context.analysisId, context.title);
                    await store.appendMessages(sessionId, [
                        messages[messages.length - 1],
                        { role: 'assistant', content: answer },
                    ]);
                } catch (err) {
                    // Saving history must never cost the user their answer
                    console.warn('Chat history not saved:', err.message);
                }
            }

            res.json({
                success: true,
                answer,
                sessionId,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/chat/ask  { question, ...same as conversation }
     * Kept for backwards compatibility: a single question with no history.
     */
    async askQuestion(req, res, next) {
        const question = typeof req.body?.question === 'string' ? req.body.question.slice(0, MAX_QUESTION_LENGTH) : '';
        req.body = { ...req.body, messages: [{ role: 'user', content: question }] };
        return module.exports.conversation(req, res, next);
    }
}

module.exports = new ChatController();
