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
const imageService = require('../src/services/imageService');

// Fake picture generator: a tiny "JPEG" per scene; can be told to fail
let imageMode = 'ok';
let imageCalls = [];
imageService.generate = async (prompt, opts) => {
    imageCalls.push({ prompt, opts });
    if (imageMode === 'fail') throw Object.assign(new Error('busy'), { code: 'IMAGE_FAILED' });
    if (imageMode === 'fail-first' && imageCalls.length === 1) throw Object.assign(new Error('busy'), { code: 'IMAGE_FAILED' });
    return { buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(2000)]), mime: 'image/jpeg', provider: 'cloudflare' };
};

youtubeService.getVideoInfo = async (videoId) => ({ videoId, title: 'Volcanoes', duration: 300, author: 'A', thumbnail: null });
youtubeService.getTranscript = async () => [{ text: 'Volcanoes erupt magma.', seconds: 0, timestamp: '0:00' }];
geminiService.analyzeVideo = async () => ({ summary: 'S', keyTakeaways: ['T'] });

const SCRIPT = {
    title: 'How Volcanoes Work',
    scenes: [
        { layout: 'title', icon: '🌋', heading: 'Volcanoes!', narration: 'Have you ever wondered what is inside a volcano?', imagePrompt: 'a smoking volcano on a tropical island', bullets: [], highlight: '', leftTitle: '', left: [], rightTitle: '', right: [] },
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
const QUIZ = {
    questions: Array.from({ length: 12 }, (_, i) => ({
        question: `Q${i + 1}?`, options: ['a', 'b', 'c', 'd'], answerIndex: i % 4, explanation: 'because',
        difficulty: ['easy', 'medium', 'hard'][i % 3], scene: (i % 4) + 1,
    })).concat([{ question: 'broken', options: ['a'], answerIndex: 3, explanation: '', difficulty: 'x', scene: 99 }]),
};
let quizPrompt = '';
let quizCalls = 0;
geminiService.withModel = async (_options, fn) => fn({
    generateContent: async (prompt) => {
        if (prompt.startsWith('Write a ')) {
            quizCalls += 1;
            quizPrompt = prompt;
            return { response: { text: () => JSON.stringify(QUIZ) } };
        }
        lastPrompt = prompt;
        return { response: { text: () => JSON.stringify(SCRIPT) } };
    },
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
    assert.equal(lesson.quiz.length, 0, 'no quiz until the viewer asks for one');
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

test('makes an AI picture for every scene and serves it', async () => {
    ttsMode = 'ok';
    imageMode = 'ok';
    imageCalls = [];
    const res = await post('/lessons', { text: 'Explain volcanoes with pictures please', audience: 'kids' });
    const lesson = await waitDone(res.body.data.id);
    assert.equal(lesson.visuals, 'pictures');
    assert.equal(lesson.scenes[0].image, 'scene-0.jpg');
    assert.equal(lesson.scenes[0].imageStatus, 'done');
    assert.equal(lesson.imageNotice, null);
    // only scenes with an imagePrompt ask for a picture (the fake script gives one to scene 0)
    assert.equal(imageCalls.length, 1);
    assert.equal(imageCalls[0].prompt, 'a smoking volcano on a tropical island');
    assert.equal(imageCalls[0].opts.audience, 'kids');
    const img = await fetch(`${base}/lessons/${lesson.id}/image/0`);
    assert.equal(img.status, 200);
    assert.match(img.headers.get('content-type'), /image\/jpeg/);
    assert.equal((await fetch(`${base}/lessons/${lesson.id}/image/1`)).status, 404, 'scene without picture');
});

test('a failed picture never fails the lesson', async () => {
    imageMode = 'fail';
    const res = await post('/lessons', { text: 'Explain volcanoes even if pictures fail' });
    const lesson = await waitDone(res.body.data.id);
    assert.equal(lesson.status, 'done');
    assert.equal(lesson.scenes[0].imageStatus, 'failed');
    assert.equal(lesson.scenes[0].image, null);
    assert.ok(lesson.imageNotice);
    assert.ok(lesson.scenes.every((s) => s.audio), 'narration still made');
    imageMode = 'ok';
});

test('simple slides mode makes no pictures', async () => {
    imageCalls = [];
    const res = await post('/lessons', { text: 'Explain volcanoes as plain slides', visuals: 'slides' });
    const lesson = await waitDone(res.body.data.id);
    assert.equal(lesson.visuals, 'slides');
    assert.equal(imageCalls.length, 0);
    assert.ok(lesson.scenes.every((s) => s.imageStatus === 'skipped'));
});

test('script prompt asks for English image prompts', async () => {
    const res = await post('/lessons', { text: 'Anything about rainbows and light', language: 'kn' });
    await waitDone(res.body.data.id);
    assert.match(lastPrompt, /"imagePrompt" in English/);
    assert.match(lastPrompt, /Kannada/);
});

test('quiz is generated only on demand: quick quiz (5) and full test (10)', async () => {
    const res = await post('/lessons', { text: 'Explain volcanoes, quiz me later', language: 'ta' });
    const lesson = await waitDone(res.body.data.id);
    assert.equal(lesson.quiz.length, 0);
    const before = quizCalls;

    const quick = await post(`/lessons/${lesson.id}/quiz`, { kind: 'quick' });
    assert.equal(quick.status, 200, JSON.stringify(quick.body));
    assert.equal(quick.body.data.questions.length, 5);
    assert.match(quizPrompt, /5-question/);
    assert.match(quizPrompt, /Tamil/);
    assert.match(quizPrompt, /2 easy, 2 medium, 1 hard/);
    assert.equal(quick.body.data.questions[0].scene, 0, 'scene numbers become 0-based');

    // asking again returns the saved quiz without calling the AI
    await post(`/lessons/${lesson.id}/quiz`, { kind: 'quick' });
    assert.equal(quizCalls - before, 1);

    const test10 = await post(`/lessons/${lesson.id}/quiz`, { kind: 'test' });
    assert.equal(test10.body.data.questions.length, 10);
    assert.match(quizPrompt, /3 easy, 5 medium, 2 hard/);
    assert.ok(test10.body.data.questions.every((q) => q.options.length === 4), 'broken question dropped');

    const saved = (await get(`/lessons/${lesson.id}`)).body.data;
    assert.equal(saved.quiz.length, 10);
    assert.equal(saved.quizKind, 'test');
});

test('quiz cannot be made before the lesson is ready', async () => {
    const res = await post('/lessons', { text: 'A lesson that is still being made' });
    const early = await post(`/lessons/${res.body.data.id}/quiz`, {});
    assert.equal(early.status, 409);
    await waitDone(res.body.data.id);
});

test('script prompt asks for 3D educational renders and no quiz', async () => {
    const res = await post('/lessons', { text: 'Explain the heart and blood flow' });
    await waitDone(res.body.data.id);
    assert.match(lastPrompt, /3D educational render/);
    assert.doesNotMatch(lastPrompt, /multiple-choice quiz/);
});
