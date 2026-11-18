const geminiService = require('../services/geminiService');
const store = require('../services/analysisStore');
const { isSupabaseEnabled } = require('../config/supabase');
const { resolveContext } = require('../services/contextResolver');
const { parseLanguage, parseMessages, MAX_QUESTION_LENGTH } = require('../utils/validators');

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

            const answer = await geminiService.chat({ messages, context, language, learner: req.learner });

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
