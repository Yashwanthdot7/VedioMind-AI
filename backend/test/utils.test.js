const test = require('node:test');
const assert = require('node:assert/strict');
const { extractVideoId, parseMessages, parseLanguage } = require('../src/utils/validators');
const { formatTimestamp, decodeEntities } = require('../src/services/youtubeService');
const youtubeService = require('../src/services/youtubeService');

test('extractVideoId handles common YouTube URL formats', () => {
    const id = 'dQw4w9WgXcQ';
    for (const url of [
        id,
        `https://www.youtube.com/watch?v=${id}`,
        `https://youtube.com/watch?v=${id}&t=42s&list=PL123`,
        `https://m.youtube.com/watch?v=${id}`,
        `https://youtu.be/${id}?si=abc`,
        `https://www.youtube.com/embed/${id}`,
        `https://www.youtube.com/shorts/${id}`,
        `https://www.youtube.com/live/${id}?feature=share`,
        `youtube.com/watch?v=${id}`,
    ]) {
        assert.equal(extractVideoId(url), id, url);
    }
});

test('extractVideoId rejects non-YouTube and malformed input', () => {
    for (const bad of ['', 'hello', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=short', null, 'x'.repeat(600)]) {
        assert.throws(() => extractVideoId(bad), { code: 'INVALID_URL' });
    }
});

test('parseLanguage defaults to English and rejects unknown codes', () => {
    assert.equal(parseLanguage(undefined), 'en');
    assert.equal(parseLanguage('kn'), 'kn');
    assert.throws(() => parseLanguage('zz'), { code: 'INVALID_LANGUAGE' });
});

test('parseMessages requires the last message to be from the user', () => {
    assert.throws(() => parseMessages([]), { code: 'INVALID_MESSAGES' });
    assert.throws(() => parseMessages([{ role: 'assistant', content: 'hi' }]), { code: 'INVALID_MESSAGES' });
    const out = parseMessages([{ role: 'system', content: 'x' }, { role: 'user', content: '  hi  ' }]);
    assert.deepEqual(out, [{ role: 'user', content: 'hi' }]);
});

test('formatTimestamp handles minutes and hours', () => {
    assert.equal(formatTimestamp(0), '0:00');
    assert.equal(formatTimestamp(75), '1:15');
    assert.equal(formatTimestamp(3725), '1:02:05');
});

test('decodeEntities fixes double-encoded captions', () => {
    assert.equal(decodeEntities('it&amp;#39;s &amp;quot;fine&amp;quot;'), 'it\'s "fine"');
});

test('mergeSegments groups short caption lines into ~15s segments', () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({ start: i * 3, text: `Line ${i}.` }));
    const segments = youtubeService.mergeSegments(lines);
    assert.ok(segments.length >= 3 && segments.length <= 5, `got ${segments.length}`);
    assert.equal(segments[0].seconds, 0);
    assert.equal(segments[0].timestamp, '0:00');
    assert.ok(segments[1].seconds >= 15);
});

test('youtube-transcript millisecond offsets are converted to seconds', async () => {
    const { YoutubeTranscript } = require('youtube-transcript');
    const original = YoutubeTranscript.fetchTranscript;
    YoutubeTranscript.fetchTranscript = async () => [
        { text: 'a', offset: 0, duration: 2500 },
        { text: 'b', offset: 65000, duration: 3000 },
    ];
    try {
        const lines = await youtubeService.fetchWithYoutubeTranscript('abcdefghijk');
        assert.deepEqual(lines.map((l) => l.start), [0, 65]);
    } finally {
        YoutubeTranscript.fetchTranscript = original;
    }
});

test('youtube-transcript second offsets are kept', async () => {
    const { YoutubeTranscript } = require('youtube-transcript');
    const original = YoutubeTranscript.fetchTranscript;
    YoutubeTranscript.fetchTranscript = async () => [
        { text: 'a', offset: 0, duration: 2.5 },
        { text: 'b', offset: 65.2, duration: 3 },
    ];
    try {
        const lines = await youtubeService.fetchWithYoutubeTranscript('abcdefghijk');
        assert.deepEqual(lines.map((l) => l.start), [0, 65.2]);
    } finally {
        YoutubeTranscript.fetchTranscript = original;
    }
});

test('getTranscript falls through providers and reports NO_TRANSCRIPT', async () => {
    const a = youtubeService.fetchWithYoutubeTranscript;
    const b = youtubeService.fetchWithInnertube;
    youtubeService.fetchWithYoutubeTranscript = async () => [];
    youtubeService.fetchWithInnertube = async () => [{ start: 3, text: 'from innertube' }];
    try {
        const segs = await youtubeService.getTranscript('abcdefghijk');
        assert.equal(segs[0].text, 'from innertube');
        youtubeService.fetchWithInnertube = async () => { throw new Error('boom'); };
        await assert.rejects(() => youtubeService.getTranscript('abcdefghijk'), { code: 'NO_TRANSCRIPT' });
    } finally {
        youtubeService.fetchWithYoutubeTranscript = a;
        youtubeService.fetchWithInnertube = b;
    }
});

test('Gemini falls back to the next model when one is retired', async () => {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test';
    const gemini = require('../src/services/geminiService');
    const tried = [];
    const realGenAI = gemini.genAI;
    gemini.activeModel = null;
    gemini.genAI = {
        getGenerativeModel: ({ model }) => ({
            generateContent: async () => {
                tried.push(model);
                if (model !== 'gemini-3.5-flash') throw new Error(`[404 Not Found] models/${model} is not found`);
                return { response: { text: () => '{"summary":"ok","keyTakeaways":["x"]}' } };
            },
        }),
    };
    try {
        const out = await gemini.analyzeVideo({ title: 't', transcript: [], language: 'en' });
        assert.equal(out.summary, 'ok');
        assert.equal(gemini.activeModel, 'gemini-3.5-flash');
        assert.ok(tried.indexOf('gemini-3.5-flash') > 0);
    } finally {
        gemini.genAI = realGenAI;
        gemini.activeModel = null;
    }
});
