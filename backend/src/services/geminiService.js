const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_MODELS, PROMPTS } = require('../types/constants');

class GeminiService {
    constructor() {
        // Ensure your API key is in your .env file
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: GEMINI_MODELS.TEXT || "gemini-1.5-flash" });
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
            return result.response.text();
        } catch (error) {
            console.error('Error generating summary:', error);
            throw new Error('Failed to generate summary');
        }
    }

    /**
     * Extract key takeaways from transcript
     */
    async extractKeyTakeaways(transcript) {
        try {
            const prompt = PROMPTS.KEY_TAKEAWAYS
                .replace('{transcript}', transcript.substring(0, 50000));

            const result = await this.model.generateContent(prompt);
            const text = result.response.text();

            // Parse the JSON array from the response
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            // Fallback: split by newlines if JSON parsing fails
            return text.split('\n').filter(line => line.trim().length > 0);
        } catch (error) {
            console.error('Error extracting key takeaways:', error);
            throw new Error('Failed to extract key takeaways');
        }
    }

    /**
     * Answer question about video (Single Turn)
     */
    async answerQuestion(question, videoContext) {
        try {
            const { title, summary, transcript } = videoContext;

            // Transcript might be a string or an array of segments
            const transcriptText = Array.isArray(transcript)
                ? transcript.map(t => t.text).join(' ')
                : transcript;

            // Using a larger slice of transcript for better accuracy in 2026
            const safeTranscript = transcriptText.substring(0, 50000);

            const prompt = PROMPTS.CHAT
                .replace('{title}', title)
                .replace('{summary}', summary)
                .replace('{transcript}', safeTranscript)
                .replace('{question}', question);

            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error('Error answering question:', error);
            throw new Error('Failed to answer question');
        }
    }

    /**
     * Chat with conversation history (Multi-Turn)
     */
    async chat(messages, videoContext) {
        try {
            // 1. Prepare history: exclude the very last message (it's sent via sendMessage)
            const history = messages.slice(0, -1).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }],
            }));

            // 2. Initialize chat session
            const chatSession = this.model.startChat({
                history: history,
                generationConfig: {
                    maxOutputTokens: 1000,
                    temperature: 0.7,
                },
            });

            // 3. Prepare the latest message with context injection
            const latestUserMessage = messages[messages.length - 1].content;
            const contextHeader = `Context for the video you are discussing:
            Title: ${videoContext.title}
            Summary: ${videoContext.summary}
            
            User Message: `;

            const result = await chatSession.sendMessage(contextHeader + latestUserMessage);
            return result.response.text();
        } catch (error) {
            console.error('Error in chat service:', error);
            throw new Error('Failed to process chat message');
        }
    }
}

module.exports = new GeminiService();