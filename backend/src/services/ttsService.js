const AppError = require('../lib/AppError');

/**
 * Gemini text-to-speech over REST (the SDK we use for text predates TTS).
 * Returns a WAV file (16-bit mono PCM) and its duration.
 */

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

// Newest first; we fall back if Google renames or retires a model
const TTS_MODELS = ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'];

// A few of Gemini's prebuilt voices, with friendly labels for the UI
const VOICES = {
    Puck: 'Upbeat',
    Kore: 'Firm',
    Aoede: 'Breezy',
    Charon: 'Informative',
    Leda: 'Youthful',
    Achird: 'Friendly',
};
const DEFAULT_VOICE_BY_AUDIENCE = { kids: 'Puck', student: 'Kore', teacher: 'Charon' };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wrap raw PCM in a WAV header so browsers can play it */
function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
    const byteRate = (sampleRate * channels * bitsPerSample) / 8;
    const blockAlign = (channels * bitsPerSample) / 8;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
}

/** "30s" / "1.5s" in Google's RetryInfo -> ms */
function retryDelayMs(body) {
    const details = body?.error?.details || [];
    const info = details.find((d) => String(d['@type'] || '').includes('RetryInfo'));
    const seconds = parseFloat(String(info?.retryDelay || '').replace('s', ''));
    return Number.isFinite(seconds) ? Math.min(seconds * 1000 + 500, 65000) : null;
}

class TtsService {
    constructor() {
        this.activeModel = null;
        this.fetch = (...args) => fetch(...args); // overridable in tests
    }

    voices() {
        return VOICES;
    }

    defaultVoice(audience) {
        return DEFAULT_VOICE_BY_AUDIENCE[audience] || 'Kore';
    }

    /**
     * @param {string} text   what to say
     * @param {object} opts   { voice, style } — style is a short delivery hint
     * @returns {Promise<{ wav: Buffer, duration: number }>}
     */
    async synthesize(text, { voice = 'Kore', style = '' } = {}) {
        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new AppError('GEMINI_API_KEY is not set on the server.', 503, 'AI_CONFIG');

        const prompt = style ? `${style}:\n${text}` : text;
        const body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[voice] ? voice : 'Kore' } } },
            },
        };

        const models = this.activeModel ? [this.activeModel, ...TTS_MODELS.filter((m) => m !== this.activeModel)] : TTS_MODELS;
        let lastError = null;

        for (const model of models) {
            for (let attempt = 0; attempt < 4; attempt += 1) {
                let res;
                try {
                    res = await this.fetch(`${API}/${model}:generateContent`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
                        body: JSON.stringify(body),
                    });
                } catch (error) {
                    lastError = new AppError(`Could not reach the voice service: ${error.message}`, 503, 'TTS_UNAVAILABLE');
                    await sleep(1500 * (attempt + 1));
                    continue;
                }

                const json = await res.json().catch(() => ({}));

                if (res.ok) {
                    const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
                    if (!part) {
                        lastError = new AppError('The voice service returned no audio.', 502, 'TTS_EMPTY');
                        break; // try next model
                    }
                    const pcm = Buffer.from(part.inlineData.data, 'base64');
                    const rate = Number((part.inlineData.mimeType || '').match(/rate=(\d+)/)?.[1]) || 24000;
                    if (this.activeModel !== model) {
                        console.log(`Using Gemini TTS model: ${model}`);
                        this.activeModel = model;
                    }
                    return { wav: pcmToWav(pcm, rate), duration: pcm.length / (rate * 2) };
                }

                const message = json?.error?.message || `HTTP ${res.status}`;
                if (res.status === 404 || /not found|not supported/i.test(message)) {
                    lastError = new AppError(`Voice model ${model} unavailable`, 503, 'TTS_UNAVAILABLE');
                    break; // next model
                }
                if (res.status === 429) {
                    // Free tier has low per-minute limits: wait as long as Google asks, then retry
                    const wait = retryDelayMs(json) ?? 15000 * (attempt + 1);
                    if (/per day|daily/i.test(message) || attempt === 3) {
                        throw new AppError('The free voice quota is used up for now. Please try again later.', 429, 'TTS_QUOTA');
                    }
                    console.warn(`TTS rate limited, waiting ${Math.round(wait / 1000)}s…`);
                    await sleep(wait);
                    continue;
                }
                if (res.status === 400 && /API key/i.test(message)) {
                    throw new AppError('The AI service is not configured correctly (check GEMINI_API_KEY).', 503, 'AI_CONFIG');
                }
                if (res.status >= 500) {
                    lastError = new AppError('The voice service had a temporary problem.', 503, 'TTS_UNAVAILABLE');
                    await sleep(2000 * (attempt + 1));
                    continue;
                }
                throw new AppError(`Voice generation failed: ${message}`, 502, 'TTS_FAILED');
            }
        }
        throw lastError || new AppError('Voice generation failed.', 503, 'TTS_UNAVAILABLE');
    }
}

module.exports = new TtsService();
module.exports.pcmToWav = pcmToWav;
module.exports.VOICES = VOICES;
module.exports.TTS_MODELS = TTS_MODELS;
