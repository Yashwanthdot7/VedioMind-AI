const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_MODELS, PROMPTS } = require('../types/constants');

class GeminiService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: GEMINI_MODELS.TEXT });
    }

    /**
     * Generate summary from transcript
     */
    async generateSummary(title, transcript) {
        try {
            const prompt = PROMPTS.SUMMARY
                .replace('{title}', title)
                .replace('{transcript}', transcript);

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Error generating summary:', error);
            throw new Error('Failed to generate summary');
        }
    }

    /**
     * Extract key takeaways
     */
    async extractKeyTakeaways(transcript) {
        try {
            const prompt = PROMPTS.KEY_TAKEAWAYS.replace('{transcript}', transcript);

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Try to parse JSON response
            try {
                const jsonMatch = text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
            } catch (e) {
                console.log('Could not parse JSON, falling back to text parsing');
            }

            // Fallback: split by lines and clean up
            return text
                .split('\n')
                .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
                .map(line => line.replace(/^[-•]\s*/, '').trim())
                .filter(line => line.length > 0);
        } catch (error) {
            console.error('Error extracting takeaways:', error);
            throw new Error('Failed to extract key takeaways');
        }
    }

    /**
     * Answer question about video
     */
    async answerQuestion(question, videoContext) {
        try {
            const { title, summary, transcript } = videoContext;

            const prompt = PROMPTS.CHAT
                .replace('{title}', title)
                .replace('{summary}', summary)
                .replace('{transcript}', transcript.substring(0, 3000)) // Limit transcript length
                .replace('{question}', question);

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Error answering question:', error);
            throw new Error('Failed to answer question');
        }
    }

    /**
     * Chat with conversation history
     */
    async chat(messages, videoContext) {
        try {
            const chat = this.model.startChat({
                history: messages.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: msg.content,
                })),
                generationConfig: {
                    maxOutputTokens: 1000,
                },
            });

            const contextPrompt = `You are analyzing this video:\nTitle: ${videoContext.title}\nSummary: ${videoContext.summary}\n\n`;
            const result = await chat.sendMessage(contextPrompt + messages[messages.length - 1].content);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Error in chat:', error);
            throw new Error('Failed to process chat message');
        }
    }
}

module.exports = new GeminiService();