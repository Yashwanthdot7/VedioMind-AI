const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GEMINI_API_KEY = 'test-key';
process.env.SUPABASE_URL = '';

const youtubeService = require('../src/services/youtubeService');
const geminiService = require('../src/services/geminiService');
const { NORMALISERS, buildPrompt } = require('../src/services/studyService');

youtubeService.getVideoInfo = async (videoId) => ({ videoId, title: 'Photosynthesis', duration: 300, author: 'A', thumbnail: null });
youtubeService.getTranscript = async () => [{ text: 'Plants use light.', seconds: 0, timestamp: '0:00' }];
geminiService.analyzeVideo = async () => ({ summary: 'S', keyTakeaways: ['T'] });

const FAKE = {
    notes: { title: 'N', overview: 'O', sections: [{ heading: 'H', timestamp: '0:00', points: ['p1'] }], keyTerms: [{ term: 't', definition: 'd' }] },
    quiz: { questions: [{ question: 'Q?', options: ['a', 'b', 'c', 'd'], answerIndex: 2, explanation: 'e', timestamp: '1:05' }] },
    flashcards: { cards: [{ front: 'F', back: 'B', timestamp: 'nonsense' }] },
    mindmap: { root: 'R', branches: [{ label: 'B1', timestamp: '', children: [{ label: 'C1', details: ['d1'] }] }] },
};
let calls = [];
geminiService.withModel = async (options, fn) => {
    const schemaProps = Object.keys(options.generationConfig.responseSchema.properties);
    const type = schemaProps.includes('questions') ? 'quiz'
        : schemaProps.includes('cards') ? 'flashcards'
            : schemaProps.includes('root') ? 'mindmap' : 'notes';
    calls.push(type);
    return fn({ generateContent: async () => ({ response: { text: () => JSON.stringify(FAKE[type]) } }) });
};

const app = require('../src/app');
let server;
let base;
test.before(async () => {
    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}/api`;
    await post('/video/process', { url: 'https://youtu.be/studyvideo1' });
});
test.after(() => server.close());

async function post(path, body) {
    const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
}

for (const type of ['notes', 'quiz', 'flashcards', 'mindmap']) {
    test(`generates ${type} and caches it`, async () => {
        calls = [];
        const first = await post(`/study/${type}`, { videoId: 'studyvideo1' });
        assert.equal(first.status, 200, JSON.stringify(first.body));
        assert.equal(first.body.cached, false);
        assert.equal(first.body.level, 'student');
        const second = await post(`/study/${type}`, { videoId: 'studyvideo1' });
        assert.equal(second.body.cached, true);
        assert.deepEqual(second.body.data, first.body.data);
        assert.deepEqual(calls, [type]);
    });
}

test('refresh regenerates and levels are cached separately', async () => {
    calls = [];
    await post('/study/quiz', { videoId: 'studyvideo1', refresh: true });
    await post('/study/quiz', { videoId: 'studyvideo1', level: 'kids' });
    await post('/study/quiz', { videoId: 'studyvideo1', level: 'kids' });
    assert.deepEqual(calls, ['quiz', 'quiz']);
});

test('flashcard timestamps that are not m:ss are dropped', async () => {
    const res = await post('/study/flashcards', { videoId: 'studyvideo1' });
    assert.equal(res.body.data.cards[0].timestamp, '');
});

test('rejects unknown tool and level', async () => {
    assert.equal((await post('/study/essay', { videoId: 'studyvideo1' })).status, 404);
    assert.equal((await post('/study/quiz', { videoId: 'studyvideo1', level: 'phd' })).status, 400);
});

test('unknown video asks client to resend context', async () => {
    const res = await post('/study/notes', { videoId: 'unknownvid2' });
    assert.equal(res.status, 410);
});

test('quiz normaliser drops questions with an invalid answer index', () => {
    const out = NORMALISERS.quiz({
        questions: [
            { question: 'ok', options: ['a', 'b'], answerIndex: 1, explanation: '', timestamp: '0:10' },
            { question: 'bad', options: ['a', 'b'], answerIndex: 5, explanation: '', timestamp: '' },
            { question: 'bad2', options: ['a'], answerIndex: 0, explanation: '', timestamp: '' },
        ],
    });
    assert.equal(out.questions.length, 1);
});

test('prompt includes language and audience level', () => {
    const p = buildPrompt('notes', 'kids', { title: 'T', summary: 'S', transcript: [{ timestamp: '0:00', text: 'x' }] }, 'kn');
    assert.match(p, /Kannada/);
    assert.match(p, /children aged 8-12/);
});
