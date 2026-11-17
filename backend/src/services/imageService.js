const AppError = require('../lib/AppError');

/**
 * Free AI pictures for lesson scenes.
 *
 * 1. Cloudflare Workers AI — FLUX.1 [schnell]. Free 10,000 Neurons/day
 *    (~170 images), needs a free account (no card). Set CLOUDFLARE_ACCOUNT_ID
 *    and CLOUDFLARE_API_TOKEN. On the free plan, going over just returns an error.
 * 2. Pollinations.ai — free, works with no account (≈1 request / 15 s).
 *    Optional POLLINATIONS_TOKEN raises the limit and removes the watermark.
 *
 * If both fail, the scene simply has no picture and the player draws the
 * illustrated slide instead.
 */

const CF_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const POLLINATIONS_URL = 'https://image.pollinations.ai/prompt/';
// anonymous limit ≈ 1 request / 15 s (overridable for tests)
const pollinationsGapMs = () => Number(process.env.POLLINATIONS_MIN_GAP_MS ?? 16000);
const TIMEOUT_MS = 90000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 3D educational renders: models, cutaways and figures, like science-museum / textbook 3D art
const STYLES = {
    kids: 'cute stylized 3D render, Pixar-like educational animation still, soft studio lighting, rounded friendly shapes, bright colors, clean background',
    student: 'high-quality 3D educational render, detailed 3D model with cutaway / cross-section where useful, clean studio lighting, realistic materials, depth of field, Blender Cycles style',
    teacher: 'detailed 3D scientific visualization, accurate cutaway model, museum-quality 3D render, soft neutral studio background, realistic materials and lighting',
};
const NEGATIVE = 'no text, no letters, no words, no captions, no watermark, no logo, safe for children';

const isPlaceholder = (v) => !v || /your[_-]/i.test(v);

class ImageService {
    constructor() {
        this.fetch = (...args) => fetch(...args); // overridable in tests
        this.pollinationsQueue = Promise.resolve();
        this.lastPollinationsAt = 0;
        this.cloudflareExhaustedUntil = 0;
    }

    cloudflareEnabled() {
        return !isPlaceholder(process.env.CLOUDFLARE_ACCOUNT_ID) && !isPlaceholder(process.env.CLOUDFLARE_API_TOKEN);
    }

    pollinationsEnabled() {
        return process.env.POLLINATIONS_DISABLED !== 'true';
    }

    enabled() {
        return this.cloudflareEnabled() || this.pollinationsEnabled();
    }

    buildPrompt(scenePrompt, audience) {
        return `${scenePrompt}. ${STYLES[audience] || STYLES.student}. Wide 16:9 composition. ${NEGATIVE}.`;
    }

    async withTimeout(promiseFactory) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            return await promiseFactory(controller.signal);
        } finally {
            clearTimeout(timer);
        }
    }

    async fromCloudflare(prompt, seed) {
        const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${CF_MODEL}`;
        const res = await this.withTimeout((signal) => this.fetch(url, {
            method: 'POST',
            signal,
            headers: {
                Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 4, seed }),
        }));
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
            const message = json?.errors?.[0]?.message || `HTTP ${res.status}`;
            if (res.status === 429 || /limit|neuron|quota/i.test(message)) {
                // Daily free allocation used up: skip Cloudflare until it resets (00:00 UTC)
                const reset = new Date();
                reset.setUTCHours(24, 0, 0, 0);
                this.cloudflareExhaustedUntil = reset.getTime();
            }
            throw new AppError(`Cloudflare image failed: ${message}`, 502, 'IMAGE_FAILED');
        }
        const b64 = json?.result?.image;
        if (!b64) throw new AppError('Cloudflare returned no image', 502, 'IMAGE_FAILED');
        return { buffer: Buffer.from(b64, 'base64'), mime: 'image/jpeg', provider: 'cloudflare' };
    }

    /** Pollinations allows ~1 anonymous request every 15 s, so requests are queued */
    fromPollinations(prompt, seed) {
        const run = async () => {
            const wait = this.lastPollinationsAt + pollinationsGapMs() - Date.now();
            if (wait > 0 && !process.env.POLLINATIONS_TOKEN) await sleep(wait);
            this.lastPollinationsAt = Date.now();

            const params = new URLSearchParams({
                width: '1280', height: '720', model: 'flux', nologo: 'true', seed: String(seed), private: 'true',
            });
            const headers = process.env.POLLINATIONS_TOKEN ? { Authorization: `Bearer ${process.env.POLLINATIONS_TOKEN}` } : {};
            const res = await this.withTimeout((signal) => this.fetch(
                `${POLLINATIONS_URL}${encodeURIComponent(prompt.slice(0, 1500))}?${params}`,
                { signal, headers },
            ));
            const type = res.headers?.get?.('content-type') || '';
            if (!res.ok || !type.startsWith('image/')) {
                throw new AppError(`Pollinations image failed: HTTP ${res.status}`, 502, 'IMAGE_FAILED');
            }
            const buffer = Buffer.from(await res.arrayBuffer());
            if (buffer.length < 1000) throw new AppError('Pollinations returned an empty image', 502, 'IMAGE_FAILED');
            return { buffer, mime: type.split(';')[0], provider: 'pollinations' };
        };
        const result = this.pollinationsQueue.then(run, run);
        this.pollinationsQueue = result.catch(() => {});
        return result;
    }

    /**
     * @returns {Promise<{buffer: Buffer, mime: string, provider: string}>}
     * @throws AppError IMAGE_FAILED if no free provider could make the picture
     */
    async generate(scenePrompt, { audience = 'student', seed = Math.floor(Math.random() * 1e6) } = {}) {
        const prompt = this.buildPrompt(scenePrompt, audience);
        const errors = [];

        if (this.cloudflareEnabled() && Date.now() >= this.cloudflareExhaustedUntil) {
            try {
                return await this.fromCloudflare(prompt, seed);
            } catch (error) {
                errors.push(error.message);
            }
        }
        if (this.pollinationsEnabled()) {
            for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                    return await this.fromPollinations(prompt, seed + attempt);
                } catch (error) {
                    errors.push(error.message);
                }
            }
        }
        throw new AppError(`No free image provider could make this picture (${errors.join('; ') || 'none configured'})`, 502, 'IMAGE_FAILED');
    }
}

module.exports = new ImageService();
module.exports.STYLES = STYLES;
