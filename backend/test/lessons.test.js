const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-key';
process.env.SUPABASE_URL = '';
process.env.LESSON_STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-'));

const youtubeService = require('../src/services/youtubeService');
const geminiService = require('../src/services/geminiService');
const ttsService = require('../src/services/ttsService');
const lessonService = require('../src/services/lessonService');
const lessonJobs = require('../src/services/lessonJobs');

youtubeService.getVideoInfo = async (videoId) => ({ videoId, title: 'Volcanoes', duration: 300, author: 'A', thumbnail: null });
youtubeService.getTranscript = async () => [{ text: 'Volcanoes erupt magma.', seconds: 0, timestamp: '0:00' }];
geminiService.analyzeVideo = async () => ({ summary: 'S', keyTakeaways: ['T'] });

const SCRIPT = {
    title: 'How Volcanoes Work',
    scenes: [
        { layout: 'title', icon: '🌋', heading: 'Volcanoes!', narration: 'Have you ever wondered what is inside a volcano?', bullets: [], highlight: '', leftTitle: '', left: [], rightTitle: '', right: [] },
        { layout: 'fact', icon: '🔥', heading: 'Hot magma', narration: 'Magma can be over a thousand degrees.', bullets: [], highlight: '1200°C', leftTitle: '', left: [], rightTitle: '', right: [] },
        { layout: 'compare', icon: '⚖️', heading: 'Magma vs lava', narration: 'Inside it is magma, outside it is lava.', bullets: [], highlight: '', leftTitle: 'Magma', left: [], rightTitle: 'Lava', right: ['Outside'] },
        { layout: 'summary', icon: '✅', heading: 'Recap', narration: 'Now you know how volcanoes work.', bullets: ['Magma rises', 'Lava flows'], highlight: '', leftTitle: '', left: [], rightTitle: '', right: [] },
    ],
    quiz: [
        { question: 'What is magma called outside?', options: ['Lava', 'Ash', 'Rock', 'Steam'], answerIndex: 0, explanation: 'Lava.' },
        { question: 'Bad', options: ['a', 'b'], answerIndex: 7, explanation: '' },
    ],
};
let lastPrompt = '';
geminiService.withModel = async (_options, fn) => fn({
    generateContent: async (prompt) => { lastPrompt = prompt; return { response: { text: () => JSON.stringify(SCRIPT) } }; },
});

// Fake Gemini TTS REST endpoint
const pcm = Buffer.alloc(24000 * 2); // 1 second of silence
let ttsMode = 'ok';
let ttsCalls = 0;
ttsService.fetch = async () => {
    ttsCalls += 1;
    if (ttsMode === 'ratelimit-once') {
        ttsMode = 'ok';
        return { ok: false, status: 429, json: async () => ({ error: { message: 'Resource exhausted (per minute)', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '0.01s' }] } }) };
    }
    if (ttsMode === 'quota') {
        return { ok: false, status: 429, json: async () => ({ error: { message: 'Quota exceeded: requests per day' } }) };
    }
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm.toString('base64') } }] } }] }) };
};

const app = require('../src/app');
let server;
let base;
test.before(async () => {
    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());

const post = async (p, body) => {
    const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
};
const get = async (p) => {
    const r = await fetch(base + p);
    return { status: r.status, body: await r.json().catch(() => null), headers: r.headers, raw: r };
};
async function waitDone(id) {
    for (let i = 0; i < 100; i += 1) {
        const { body } = await get(`/lessons/${id}`);
        if (body.data.status === 'done' || body.data.status === 'failed') return body.data;
        await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('lesson did not finish');
}

test('creates a lesson from text: script, narration audio, quiz', async () => {
    ttsMode = 'ok';
    const res = await post('/lessons', { text: 'Explain how volcanoes work for my class', audience: 'kids', language: 'hi', length: 'short' });
    assert.equal(res.status, 202);
    assert.equal(res.body.data.status, 'queued');
    assert.equal(res.body.data.userId, undefined, 'owner id must not leak');

    const lesson = await waitDone(res.body.data.id);
    assert.equal(lesson.status, 'done', lesson.error);
    assert.equal(lesson.title, 'How Volcanoes Work');
    assert.equal(lesson.voiceMode, 'gemini');
    assert.equal(lesson.voice, 'Puck', 'kids default voice');
    assert.equal(lesson.scenes.length, 4);
    assert.equal(lesson.scenes[2].layout, 'bullets', 'compare with an empty side falls back');
    assert.ok(lesson.scenes.every((s) => s.audio && s.duration === 1));
    assert.equal(lesson.durationSec, 4);
    assert.equal(lesson.quiz.length, 1, 'invalid quiz question dropped');
    assert.match(lastPrompt, /Hindi/);
    assert.match(lastPrompt, /children aged 8-12/);

    const audio = await fetch(`${base}/lessons/${lesson.id}/audio/0`);
    assert.equal(audio.status, 200);
    assert.equal(audio.headers.get('content-type'), 'audio/wav');
    const buf = Buffer.from(await audio.arrayBuffer());
    assert.equal(buf.subarray(0, 4).toString(), 'RIFF');
    assert.equal(buf.length, 44 + pcm.length);
});

test('retries after a per-minute rate limit', async () => {
    ttsMode = 'ratelimit-once';
    const res = await post('/lessons', { text: 'Explain photosynthesis in simple words please', length: 'short' });
    const lesson = await waitDone(res.body.data.id);
    assert.equal(lesson.status, 'done');
    assert.equal(lesson.voiceMode, 'gemini');
});

test('falls back to the free browser voice when the daily quota is used up', async () => {
    ttsMode = 'quota';
    const res = await post('/lessons', { text: 'Explain the water cycle for students', length: 'short' });
    const lesson = await waitDone(res.body.data.id);
    assert.equal(lesson.status, 'done');
    assert.equal(lesson.voiceMode, 'browser');
    assert.ok(lesson.voiceNotice);
    assert.ok(lesson.scenes.every((s) => !s.audio));
    assert.equal((await fetch(`${base}/lessons/${lesson.id}/audio/0`)).status, 404);
    ttsMode = 'ok';
});

test('creates a lesson from a processed YouTube video', async () => {
    await post('/video/process', { url: 'https://youtu.be/volcanovid1' });
    const res = await post('/lessons', { videoId: 'volcanovid1', audience: 'teacher', length: 'standard' });
    assert.equal(res.status, 202, JSON.stringify(res.body));
    const lesson = await waitDone(res.body.data.id);
    assert.equal(lesson.source, 'video');
    assert.equal(lesson.sourceVideo.title, 'Volcanoes');
    assert.match(lastPrompt, /Volcanoes erupt magma/);
    assert.match(lastPrompt, /8-10 scenes/);
});

test('validates input', async () => {
    assert.equal((await post('/lessons', {})).status, 400);
    assert.equal((await post('/lessons', { text: 'hi' })).status, 400);
    assert.equal((await post('/lessons', { text: 'A good long topic here', audience: 'aliens' })).status, 400);
    assert.equal((await post('/lessons', { text: 'A good long topic here', length: 'epic' })).status, 400);
    assert.equal((await get('/lessons/not-a-uuid')).status, 404);
});

test("another user's lesson is not visible", async () => {
    const res = await post('/lessons', { text: 'Private lesson about stars and planets' });
    const lesson = await waitDone(res.body.data.id);
    const stored = await lessonJobs.get(lesson.id);
    stored.userId = '00000000-0000-0000-0000-000000000001';
    assert.equal((await get(`/lessons/${lesson.id}`)).status, 404);
    assert.equal((await fetch(`${base}/lessons/${lesson.id}/audio/0`)).status, 404);
});

test('options lists voices and lengths', async () => {
    const res = await get('/lessons/options');
    assert.ok(res.body.data.voices.Puck);
    assert.ok(res.body.data.lengths.short);
});

test('pcmToWav writes a valid header', () => {
    const wav = ttsService.pcmToWav(Buffer.alloc(100), 24000);
    assert.equal(wav.readUInt32LE(24), 24000);
    assert.equal(wav.readUInt32LE(40), 100);
});

test('script normaliser keeps layouts sane', () => {
    const out = lessonService.normalise({ title: 't', scenes: [{ layout: 'weird', icon: '', heading: 'H', narration: 'N', bullets: [] }], quiz: [] });
    assert.equal(out.scenes[0].layout, 'title');
    assert.equal(out.scenes[0].icon, '💡');
});
