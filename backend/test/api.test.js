const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GEMINI_API_KEY = 'test-key';
process.env.SUPABASE_URL = '';

// Mock YouTube + Gemini before the app loads them
const youtubeService = require('../src/services/youtubeService');
const geminiService = require('../src/services/geminiService');

let geminiAnalyzeCalls = 0;
youtubeService.getVideoInfo = async (videoId) => ({ videoId, title: 'Test Video', duration: 120, author: 'Tester', thumbnail: 'x' });
youtubeService.getTranscript = async () => [
    { text: 'Hello and welcome.', seconds: 0, timestamp: '0:00' },
    { text: 'Photosynthesis turns light into energy.', seconds: 20, timestamp: '0:20' },
];
geminiService.analyzeVideo = async ({ language }) => {
    geminiAnalyzeCalls += 1;
    return { summary: `Summary in ${language}`, keyTakeaways: ['One', 'Two'] };
};
let lastChatArgs = null;
geminiService.chat = async (args) => { lastChatArgs = args; return 'See [0:20].'; };

const app = require('../src/app');

let server;
let base;
test.before(async () => {
    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());

const post = (path, body) => fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json() }));

test('process returns analysis and caches repeat requests', async () => {
    const first = await post('/video/process', { url: 'https://youtu.be/abcdefghijk', language: 'hi' });
    assert.equal(first.status, 200);
    assert.equal(first.body.data.summary, 'Summary in hi');
    assert.equal(first.body.data.videoId, 'abcdefghijk');
    assert.equal(first.body.cached, false);

    const second = await post('/video/process', { url: 'https://www.youtube.com/watch?v=abcdefghijk', language: 'hi' });
    assert.equal(second.body.cached, true);
    assert.equal(geminiAnalyzeCalls, 1);
});

test('concurrent requests for the same video call Gemini once', async () => {
    const before = geminiAnalyzeCalls;
    await Promise.all([1, 2, 3].map(() => post('/video/process', { url: 'https://youtu.be/zzzzzzzzzzz' })));
    assert.equal(geminiAnalyzeCalls - before, 1);
});

test('chat uses cached transcript without the client resending it', async () => {
    const res = await post('/chat/conversation', {
        videoId: 'abcdefghijk',
        language: 'hi',
        messages: [{ role: 'user', content: 'What is photosynthesis?' }],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.answer, 'See [0:20].');
    assert.equal(lastChatArgs.context.title, 'Test Video');
    assert.equal(lastChatArgs.language, 'hi');
});

test('chat on unknown video asks the client to resend context', async () => {
    const res = await post('/chat/conversation', {
        videoId: 'unknownvid1',
        messages: [{ role: 'user', content: 'hi' }],
    });
    assert.equal(res.status, 410);
    assert.equal(res.body.code, 'CONTEXT_EXPIRED');

    const retry = await post('/chat/conversation', {
        videoId: 'unknownvid1',
        messages: [{ role: 'user', content: 'hi' }],
        videoContext: { title: 'T', summary: 'S', transcript: [{ text: 'a', timestamp: '0:00', seconds: 0 }] },
    });
    assert.equal(retry.status, 200);
});

test('legacy /chat/ask still works', async () => {
    const res = await post('/chat/ask', { question: 'Q?', videoId: 'abcdefghijk', language: 'hi' });
    assert.equal(res.status, 200);
});

test('library requires accounts', async () => {
    const res = await fetch(`${base}/library`);
    assert.equal(res.status, 501);
});
