const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const AppError = require('../lib/AppError');
const { languageName } = require('../config/languages');
const { MODEL_CANDIDATES, PROMPTS, LIMITS } = require('../types/constants');

const TRANSCRIPT_SCHEMA = {
    type: SchemaType.ARRAY,
    items: {
        type: SchemaType.OBJECT,
        properties: {
            start: { type: SchemaType.INTEGER, description: 'Start time of the segment in whole seconds from the beginning of the video.' },
            text: { type: SchemaType.STRING, description: 'Exactly what is said in this segment.' },
        },
        required: ['start', 'text'],
    },
};

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

const isModelUnavailable = (error) => /\b404\b|not found|is not supported|no longer available|deprecated/i.test(error?.message || '');

class GeminiService {
    constructor() {
        const preferred = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : [];
        this.candidates = [...new Set([...preferred, ...MODEL_CANDIDATES])];
        this.activeModel = null;
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'missing-key');
    }

    /**
     * Run `fn(model)` on the first Gemini model that exists. Google retires
     * model names regularly, so we fall back down the list and remember the
     * first one that works.
     */
    async withModel(options, fn) {
        if (!process.env.GEMINI_API_KEY) {
            throw new AppError('GEMINI_API_KEY is not set on the server.', 503, 'AI_CONFIG');
        }
        const order = this.activeModel
            ? [this.activeModel, ...this.candidates.filter((m) => m !== this.activeModel)]
            : this.candidates;

        let lastError;
        for (const name of order) {
            try {
                const model = this.genAI.getGenerativeModel({ model: name, ...options });
                const result = await fn(model);
                if (this.activeModel !== name) {
                    console.log(`Using Gemini model: ${name}`);
                    this.activeModel = name;
                }
                return result;
            } catch (error) {
                lastError = error;
                if (!isModelUnavailable(error)) throw error;
                console.warn(`Gemini model ${name} unavailable, trying the next one…`);
            }
        }
        throw lastError;
    }

    /**
     * Summary + key takeaways in ONE call, as structured JSON.
     */
    async analyzeVideo({ title, transcript, language }) {
        const options = {
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: ANALYSIS_SCHEMA,
                temperature: 0.4,
            },
        };

        const prompt = PROMPTS.ANALYZE
            .replace('{language}', languageName(language))
            .replace('{title}', title)
            .replace('{transcript}', formatTranscript(transcript));

        let raw;
        try {
            raw = await this.withModel(options, async (model) => {
                const result = await model.generateContent(prompt);
                return result.response.text();
            });
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

        const options = {
            systemInstruction,
            generationConfig: { maxOutputTokens: 1500, temperature: 0.5 },
        };

        // Gemini history must start with a user turn
        const history = messages.slice(0, -1).map((m) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
        }));
        while (history.length && history[0].role !== 'user') history.shift();

        const latest = messages[messages.length - 1].content;

        try {
            return await this.withModel(options, async (model) => {
                const session = model.startChat({ history });
                const result = await session.sendMessage(latest);
                return result.response.text().trim();
            });
        } catch (error) {
            throw wrapGeminiError(error, 'Failed to answer your question. Please try again.');
        }
    }

    /**
     * Fallback when YouTube captions can't be fetched: Gemini watches the
     * public video itself and transcribes the speech with timestamps.
     * Returns [{ start (seconds), text }].
     */
    async transcribeYouTube(videoId) {
        const options = {
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: TRANSCRIPT_SCHEMA,
                temperature: 0,
                maxOutputTokens: 65536,
                // Speech is what matters; low-res frames cut the cost ~3x
                mediaResolution: 'MEDIA_RESOLUTION_LOW',
            },
        };

        let raw;
        try {
            raw = await this.withModel(options, async (model) => {
                const result = await model.generateContent([
                    { fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}`, mimeType: 'video/*' } },
                    { text: PROMPTS.TRANSCRIBE },
                ]);
                return result.response.text();
            });
        } catch (error) {
            const msg = error?.message || '';
            if (/private|unlisted|not.*public|permission|access/i.test(msg)) {
                throw new AppError('This video is private or unlisted, so the AI can\'t watch it.', 422, 'NO_TRANSCRIPT');
            }
            throw wrapGeminiError(error, 'The AI could not transcribe this video.');
        }

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            // Output can be cut off for very long videos; keep the complete segments
            const lastComplete = raw.lastIndexOf('}');
            try {
                parsed = lastComplete > 0 ? JSON.parse(`${raw.slice(0, lastComplete + 1)}]`) : [];
            } catch {
                parsed = [];
            }
        }

        return (Array.isArray(parsed) ? parsed : [])
            .map((s) => ({ start: Math.max(0, Number(s.start) || 0), text: String(s.text || '').trim() }))
            .filter((s) => s.text)
            .sort((a, b) => a.start - b.start);
    }
}

module.exports = new GeminiService();
module.exports.formatTranscript = formatTranscript;
