const geminiService = require('../services/geminiService');

class ChatController {
    /**
     * Ask a question about the video
     */
    async askQuestion(req, res, next) {
        try {
            const { question, videoContext } = req.body;

            if (!question || !videoContext) {
                return res.status(400).json({
                    error: 'Question and video context are required'
                });
            }

            const answer = await geminiService.answerQuestion(question, videoContext);

            res.json({
                success: true,
                answer,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Chat error:', error);
            next(error);
        }
    }

    /**
     * Handle conversation with history
     */
    async conversation(req, res, next) {
        try {
            const { messages, videoContext } = req.body;

            if (!messages || !videoContext) {
                return res.status(400).json({
                    error: 'Messages and video context are required'
                });
            }

            const response = await geminiService.chat(messages, videoContext);

            res.json({
                success: true,
                answer: response,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Conversation error:', error);
            next(error);
        }
    }
}

module.exports = new ChatController();