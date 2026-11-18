const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-key';
process.env.LESSON_STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'share-'));

const TEACHER = 'token-teacher';
const OTHER = 'token-other';
const fake = require('./helpers/fakeSupabase').install({
    [TEACHER]: { id: '11111111-1111-4111-8111-111111111111' },
    [OTHER]: { id: '22222222-2222-4222-8222-222222222222' },
});

const geminiService = require('../src/services/geminiService');
const ttsService = require('../src/services/ttsService');
const lessonJobs = require('../src/services/lessonJobs');
const courseJobs = require('../src/services/courseJobs');

const scene = (layout, heading) => ({ layout, icon: '⭐', heading, narration: `${heading}.`, imagePrompt: 'x', bullets: ['a'], highlight: '', leftTitle: '', left: [], rightTitle: '', right: [] });
geminiService.withModel = async (_o, fn) => fn({
    generateContent: async (prompt) => ({
        response: {
            text: () => JSON.stringify(prompt.startsWith('You are planning')
                ? { title: 'Stars', modules: [1, 2, 3].map((i) => ({ title: `Module ${i}`, goal: 'g', keyPoints: ['k'] })) }
                : { title: 'Stars', scenes: [scene('title', 'A'), scene('summary', 'B')] }),
        },
    }),
});
const pcm = Buffer.alloc(4800);
ttsService.fetch = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm.toString('base64') } }] } }] }) });

const app = require('../src/app');
let server;
let base;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); base = `http://127.0.0.1:${server.address().port}/api`; });
test.after(() => server.close());

const call = async (method, p, token, body) => {
    const r = await fetch(base + p, {
        method,
        headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => null) };
};

async function teacherLesson() {
    const res = await call('POST', '/lessons', TEACHER, { text: 'How do stars shine? Explain nuclear fusion.', visuals: 'slides' });
    await lessonJobs.whenDone(res.body.data.id);
    return res.body.data.id;
}

test('a private lesson becomes watchable by anyone with the class link, and stops when turned off', async () => {
    const id = await teacherLesson();
    assert.equal((await call('GET', `/lessons/${id}`)).status, 404, 'private before sharing');
    assert.equal((await call('GET', `/lessons/${id}`, TEACHER)).body.data.isOwner, true);

    // Only the owner can share
    assert.equal((await call('POST', `/lessons/${id}/share`, OTHER, { public: true })).status, 404);
    assert.equal((await call('POST', `/lessons/${id}/share`, null, { public: true })).status, 404);

    const shared = await call('POST', `/lessons/${id}/share`, TEACHER, { public: true });
    assert.equal(shared.status, 200);
    const slug = shared.body.data.shareSlug;
    assert.match(slug, /^[A-Za-z0-9_-]{10}$/);
    assert.equal(fake.tables.generated_videos.find((r) => r.id === id).share_slug, slug, 'saved to the database');

    // A student with no account
    const hit = await call('GET', `/shared/${slug}`);
    assert.deepEqual({ kind: hit.body.data.kind, id: hit.body.data.id }, { kind: 'lesson', id });
    const asStudent = await call('GET', `/lessons/${id}`);
    assert.equal(asStudent.status, 200);
    assert.equal(asStudent.body.data.isOwner, false);
    assert.equal(asStudent.body.data.shareSlug, null, 'students do not see the owner controls');
    assert.equal((await fetch(`${base}/lessons/${id}/audio/0`)).status, 200, 'narration plays');
    assert.equal((await call('DELETE', `/lessons/${id}`)).status, 403, 'students cannot delete');

    // Turned off: link and lesson are private again; turning it back on keeps the same link
    await call('POST', `/lessons/${id}/share`, TEACHER, { public: false });
    assert.equal((await call('GET', `/shared/${slug}`)).status, 404);
    assert.equal((await call('GET', `/lessons/${id}`)).status, 404);
    const again = await call('POST', `/lessons/${id}/share`, TEACHER, { public: true });
    assert.equal(again.body.data.shareSlug, slug);
});

test('sharing a course opens every module, including ones made later', async () => {
    const res = await call('POST', '/courses', TEACHER, { text: 'Teach the life cycle of stars', modules: 3, visuals: 'slides' });
    const id = res.body.data.id;
    // Share straight away, while modules are still being made
    const shared = await call('POST', `/courses/${id}/share`, TEACHER, { public: true });
    assert.equal(shared.status, 200);
    await courseJobs.whenDone(id);

    const hit = await call('GET', `/shared/${shared.body.data.shareSlug}`);
    assert.equal(hit.body.data.kind, 'course');
    const course = (await call('GET', `/courses/${id}`)).body.data;
    assert.equal(course.modules.length, 3);
    for (const m of course.modules) {
        assert.equal((await call('GET', `/lessons/${m.lessonId}`)).status, 200, `module ${m.index + 1} is open to students`);
    }
    // A single module can't be shared on its own
    assert.equal((await call('POST', `/lessons/${course.modules[0].lessonId}/share`, TEACHER, { public: true })).status, 400);

    await call('POST', `/courses/${id}/share`, TEACHER, { public: false });
    assert.equal((await call('GET', `/lessons/${course.modules[0].lessonId}`)).status, 404, 'modules close with the course');
});

test('bad or unknown links are a clear 404', async () => {
    for (const slug of ['x', '../../etc', 'AAAAAAAAAAAA']) {
        const r = await call('GET', `/shared/${encodeURIComponent(slug)}`);
        assert.equal(r.status, 404);
        assert.equal(r.body.code, 'SHARE_NOT_FOUND');
    }
});
