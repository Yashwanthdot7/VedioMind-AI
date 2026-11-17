const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const AppError = require('../lib/AppError');
const { languageName } = require('../config/languages');
const { DEFAULT_MODEL, PROMPTS, LIMITS } = require('../types/constants');

const ANALYSIS_SCHEMA = {
    type: SchemaType.OBJECT,
    properties: {
        summary: {
            type: SchemaType.STRING,
            description: 'Markdown summary: short overview paragraph, then "- " bullet points, then a conclusion.',
        },
        keyTakeaways: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: '5 to 7 concise, insightful takeaways.',
        },
    },
    required: ['summary', 'keyTakeaways'],
};

/**
 * Format transcript segments as "[m:ss] text" lines so the model can cite timestamps.
 * Keeps the start and end of very long transcripts if they exceed the limit.
 */
function formatTranscript(transcript, maxChars = LIMITS.TRANSCRIPT_CHARS) {
    const text = Array.isArray(transcript)
        ? transcript.map((s) => `[${s.timestamp}] ${s.text}`).join('\n')
        : String(transcript || '');

    if (text.length <= maxChars) return text;
    const head = Math.floor(maxChars * 0.7);
    const tail = maxChars - head;
    return `${text.slice(0, head)}\n\n[... middle of transcript omitted for length ...]\n\n${text.slice(-tail)}`;
}

function wrapGeminiError(error, fallbackMessage) {
    const msg = error?.message || '';
    console.error('Gemini error:', msg);
    if (msg.includes('API key') || msg.includes('API_KEY')) {
        return new AppError('The AI service is not configured correctly (check GEMINI_API_KEY).', 503, 'AI_CONFIG');
    }
    if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        return new AppError('The AI service is busy or out of quota. Please try again in a minute.', 503, 'AI_QUOTA');
    }
    if (msg.toLowerCase().includes('safety') || msg.toLowerCase().includes('blocked')) {
        return new AppError('The AI declined to respond to this content.', 422, 'AI_BLOCKED');
    }
    return new AppError(fallbackMessage, 503, 'AI_UNAVAILABLE');
}

class GeminiService {
    constructor() {
        this.modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'missing-key');
    }

    model(options = {}) {
        if (!process.env.GEMINI_API_KEY) {
            throw new AppError('GEMINI_API_KEY is not set on the server.', 503, 'AI_CONFIG');
        }
        return this.genAI.getGenerativeModel({ model: this.modelName, ...options });
    }

    /**
     * Summary + key takeaways in ONE call, as structured JSON.
     */
    async analyzeVideo({ title, transcript, language }) {
        const model = this.model({
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: ANALYSIS_SCHEMA,
                temperature: 0.4,
            },
        });

        const prompt = PROMPTS.ANALYZE
            .replace('{language}', languageName(language))
            .replace('{title}', title)
            .replace('{transcript}', formatTranscript(transcript));

        let raw;
        try {
            const result = await model.generateContent(prompt);
            raw = result.response.text();
        } catch (error) {
            throw wrapGeminiError(error, 'Failed to analyse the video. Please try again.');
        }

        try {
            const parsed = JSON.parse(raw);
            return {
                summary: String(parsed.summary || '').trim(),
                keyTakeaways: (Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [])
                    .map((t) => String(t).trim())
                    .filter(Boolean)
                    .slice(0, LIMITS.MAX_TAKEAWAYS),
            };
        } catch {
            // Very rare with JSON mode, but never fail the whole request over formatting
            return { summary: raw.trim(), keyTakeaways: [] };
        }
    }

    /**
     * Multi-turn chat about a video. The transcript goes in the system
     * instruction, so earlier turns stay grounded in the video.
     */
    async chat({ messages, context, language }) {
        const systemInstruction = PROMPTS.CHAT_SYSTEM
            .replace('{language}', languageName(language))
            .replace('{title}', context.title)
            .replace('{summary}', context.summary || '')
            .replace('{transcript}', formatTranscript(context.transcript, LIMITS.CHAT_TRANSCRIPT_CHARS));

        const model = this.model({
            systemInstruction,
            generationConfig: { maxOutputTokens: 1200, temperature: 0.5 },
        });

        // Gemini history must start with a user turn
        const history = messages.slice(0, -1).map((m) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
        }));
        while (history.length && history[0].role !== 'user') history.shift();

        const latest = messages[messages.length - 1].content;

        try {
            const session = model.startChat({ history });
            const result = await session.sendMessage(latest);
            return result.response.text().trim();
        } catch (error) {
            throw wrapGeminiError(error, 'Failed to answer your question. Please try again.');
        }
    }
}

module.exports = new GeminiService();
module.exports.formatTranscript = formatTranscript;
