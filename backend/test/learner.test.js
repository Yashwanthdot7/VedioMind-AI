const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-key';
process.env.LESSON_STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-'));

const STUDENT = 'token-student';
const TEACHER = 'token-teacher';
const fake = require('./helpers/fakeSupabase').install({
    [STUDENT]: { id: '44444444-4444-4444-8444-444444444444' },
    [TEACHER]: { id: '55555555-5555-4555-8555-555555555555' },
});

const youtube = require('../src/services/youtubeService');
const gemini = require('../src/services/geminiService');
const tts = require('../src/services/ttsService');
const lessonJobs = require('../src/services/lessonJobs');
const courseJobs = require('../src/services/courseJobs');
const { learnerGuidance, parseLearnerHeader } = require('../src/config/learner');

youtube.getVideoInfo = async (videoId) => ({ videoId, title: 'Photosynthesis', duration: 300, author: 'A', thumbnail: null });
youtube.getTranscript = async () => [{ text: 'Plants make glucose from light.', seconds: 0, timestamp: '0:00' }, { text: 'Chlorophyll absorbs light.', seconds: 20, timestamp: '0:20' }];
gemini.analyzeVideo = async () => ({ summary: 'Standard summary [0:20].', keyTakeaways: ['Standard takeaway'] });

const calls = { prompts: [], system: [] };
const scene = (layout, heading) => ({ layout, icon: '🌱', heading, narration: `${heading}.`, imagePrompt: 'x', bullets: ['a'], highlight: '', leftTitle: '', left: [], rightTitle: '', right: [] });
const PLAN = {
    objectives: ['Explain photosynthesis'], durationMinutes: 40, materials: [],
    steps: [{ minutes: 10, title: 'Hook', teacher: 'Ask why leaves are green', students: 'Discuss', scene: 1 }],
    misconceptions: [{ misconception: 'Plants eat soil', fix: 'Show the van Helmont experiment' }],
    activity: { title: 'Leaf hunt', instructions: 'Collect leaves' }, questions: ['Why green?'], exitTicket: ['Name the gas'], differentiation: 'Pair up.',
};
gemini.withModel = async (options, fn) => {
    if (options?.systemInstruction) calls.system.push(options.systemInstruction);
    return fn({
        startChat: () => ({ sendMessage: async () => ({ response: { text: () => 'An answer.' } }) }),
        generateContent: async (prompt) => {
            calls.prompts.push(prompt);
            const p = String(prompt);
            let body;
            if (p.startsWith('Rewrite this video')) body = { summary: p.includes('BEGINNER') ? 'Simple summary [0:20].' : 'Deep summary [0:20].', keyTakeaways: ['Leveled takeaway'] };
            else if (p.startsWith('Write a practical lesson plan')) body = PLAN;
            else if (p.startsWith('You are planning')) body = { title: 'Course', modules: [1, 2, 3].map((i) => ({ title: `M${i}`, goal: 'g', keyPoints: ['k'] })) };
            else body = { title: 'Leaves', scenes: [scene('title', 'Start'), scene('summary', 'End')] };
            return { response: { text: () => JSON.stringify(body) } };
        },
    });
};
const pcm = Buffer.alloc(4800);
tts.fetch = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm.toString('base64') } }] } }] }) });

const app = require('../src/app');
let server;
let base;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); base = `http://127.0.0.1:${server.address().port}/api`; });
test.after(() => server.close());

const call = async (method, p, { token, learner, body } = {}) => {
    const r = await fetch(base + p, {
        method,
        headers: {
            'content-type': 'application/json',
            ...(token && { authorization: `Bearer ${token}` }),
            ...(learner && { 'x-learner': learner }),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => null) };
};
const lastPrompt = (startsWith) => [...calls.prompts].reverse().find((p) => String(p).startsWith(startsWith)) || '';

test('learner header parsing falls back safely', () => {
    assert.deepEqual(parseLearnerHeader('student:beginner'), { role: 'student', level: 'beginner' });
    assert.deepEqual(parseLearnerHeader('teacher:advanced'), { role: 'teacher', level: 'advanced' });
    assert.deepEqual(parseLearnerHeader('hacker:root'), { role: 'student', level: 'intermediate' });
    assert.deepEqual(parseLearnerHeader(undefined), { role: 'student', level: 'intermediate' });
    assert.match(learnerGuidance({ role: 'teacher' }), /TEACHER/);
});

test('profile: sign-up choice is saved, validated and used on later requests', async () => {
    assert.equal((await call('GET', '/profile')).status, 401);
    const first = await call('GET', '/profile', { token: STUDENT });
    assert.equal(first.body.data.onboarded, false);

    assert.equal((await call('PUT', '/profile', { token: STUDENT, body: { role: 'admin' } })).status, 400);
    assert.equal((await call('PUT', '/profile', { token: STUDENT, body: { role: 'student', level: 'genius' } })).status, 400);
    const saved = await call('PUT', '/profile', { token: STUDENT, body: { role: 'student', level: 'beginner' } });
    assert.deepEqual(saved.body.data, { role: 'student', level: 'beginner', onboarded: true });
    assert.equal(fake.tables.profiles.find((p) => p.id.startsWith('4444')).level, 'beginner');
    await call('PUT', '/profile', { token: TEACHER, body: { role: 'teacher' } });

    // A signed-in user's profile beats whatever header the browser sends
    await call('POST', '/chat/conversation', { token: STUDENT, learner: 'student:advanced', body: { videoId: 'abcdefghijk', language: 'en', messages: [{ role: 'user', content: 'Why?' }], videoContext: { title: 'T', summary: 'S', transcript: [] } } });
    assert.match(calls.system.at(-1), /BEGINNER/);
});

test('summaries: beginners and advanced students get their own version; intermediate and teachers the shared one', async () => {
    const url = 'https://youtu.be/abcdefghijk';
    const beginner = await call('POST', '/video/process', { token: STUDENT, body: { url, language: 'en' } });
    assert.equal(beginner.body.data.level, 'beginner');
    assert.equal(beginner.body.data.summary, 'Simple summary [0:20].');
    assert.deepEqual(beginner.body.data.keyTakeaways, ['Leveled takeaway']);
    assert.ok(beginner.body.data.transcript.length, 'transcript is unchanged');

    const guest = await call('POST', '/video/process', { body: { url, language: 'en' } });
    assert.equal(guest.body.data.summary, 'Standard summary [0:20].');
    const teacher = await call('POST', '/video/process', { token: TEACHER, body: { url, language: 'en' } });
    assert.equal(teacher.body.data.level, 'intermediate');

    const advanced = await call('POST', '/video/summary', { learner: 'student:advanced', body: { videoId: 'abcdefghijk', analysisId: guest.body.data.analysisId, language: 'en', level: 'advanced', videoContext: { title: 'Photosynthesis', summary: 'Standard summary [0:20].', transcript: [] } } });
    assert.equal(advanced.body.data.summary, 'Deep summary [0:20].');
    const before = calls.prompts.length;
    await call('POST', '/video/summary', { body: { videoId: 'abcdefghijk', analysisId: guest.body.data.analysisId, language: 'en', level: 'advanced', videoContext: { title: 'Photosynthesis', summary: 'x', transcript: [] } } });
    assert.equal(calls.prompts.length, before, 'cached per level');
    assert.equal((await call('POST', '/video/summary', { body: { videoId: 'abcdefghijk', language: 'en', level: 'expert', videoContext: { title: 'T', summary: 'S', transcript: [] } } })).status, 400);
});

test('guest chat follows the level chosen in the browser', async () => {
    await call('POST', '/chat/conversation', { learner: 'student:advanced', body: { videoId: 'abcdefghijk', language: 'en', messages: [{ role: 'user', content: 'Why?' }], videoContext: { title: 'T', summary: 'S', transcript: [] } } });
    assert.match(calls.system.at(-1), /ADVANCED/);
});

test('student lessons are written at the learner level by default', async () => {
    const res = await call('POST', '/lessons', { token: STUDENT, body: { text: 'How do leaves make food from light?', visuals: 'slides' } });
    await lessonJobs.whenDone(res.body.data.id);
    const lesson = (await call('GET', `/lessons/${res.body.data.id}`, { token: STUDENT })).body.data;
    assert.equal(lesson.audience, 'student');
    assert.equal(lesson.level, 'beginner');
    assert.match(lastPrompt('You are an expert educator'), /BEGINNER/);
    // Explicit choice wins
    const adv = await call('POST', '/lessons', { token: STUDENT, body: { text: 'How do leaves make food from light?', level: 'advanced', visuals: 'slides' } });
    await lessonJobs.whenDone(adv.body.data.id);
    assert.match(lastPrompt('You are an expert educator'), /ADVANCED/);
});

test('teachers get a teaching guide by default, or a class video, and a lesson plan on demand', async () => {
    const guide = await call('POST', '/lessons', { token: TEACHER, body: { text: 'Teach photosynthesis to class 7', visuals: 'slides' } });
    await lessonJobs.whenDone(guide.body.data.id);
    let lesson = (await call('GET', `/lessons/${guide.body.data.id}`, { token: TEACHER })).body.data;
    assert.equal(lesson.audience, 'teacher');
    assert.equal(lesson.teacherMode, 'guide');
    assert.match(lastPrompt('You are an expert educator'), /TEACHING GUIDE for the teacher/);

    const before = calls.prompts.length;
    const plan = await call('POST', `/lessons/${lesson.id}/plan`, { token: TEACHER });
    assert.equal(plan.status, 200);
    assert.equal(plan.body.data.steps[0].title, 'Hook');
    assert.equal(plan.body.data.misconceptions[0].fix, 'Show the van Helmont experiment');
    assert.match(lastPrompt('Write a practical lesson plan'), /teacher's own guide/);
    await call('POST', `/lessons/${lesson.id}/plan`, { token: TEACHER });
    assert.equal(calls.prompts.length, before + 1, 'the plan is made once and saved');
    lesson = (await call('GET', `/lessons/${lesson.id}`, { token: TEACHER })).body.data;
    assert.equal(lesson.teacherPlan.durationMinutes, 40);

    const forClass = await call('POST', '/lessons', { token: TEACHER, body: { text: 'Teach photosynthesis to class 7', teacherMode: 'class', level: 'beginner', visuals: 'slides' } });
    await lessonJobs.whenDone(forClass.body.data.id);
    const script = lastPrompt('You are an expert educator');
    assert.match(script, /show this video to their class/);
    assert.match(script, /BEGINNER/);
    assert.doesNotMatch(script, /TEACHING GUIDE for the teacher/);
    await call('POST', `/lessons/${forClass.body.data.id}/plan`, { token: TEACHER });
    assert.match(lastPrompt('Write a practical lesson plan'), /SHOW this video to the class/);
});

test('course modules inherit the level and teacher mode', async () => {
    const res = await call('POST', '/courses', { token: TEACHER, body: { text: 'Plants and light', modules: 3, teacherMode: 'class', level: 'advanced', visuals: 'slides' } });
    await courseJobs.whenDone(res.body.data.id);
    const course = (await call('GET', `/courses/${res.body.data.id}`, { token: TEACHER })).body.data;
    assert.equal(course.status, 'done');
    const module1 = (await call('GET', `/lessons/${course.modules[0].lessonId}`, { token: TEACHER })).body.data;
    assert.equal(module1.teacherMode, 'class');
    assert.equal(module1.level, 'advanced');
    assert.match(lastPrompt('You are planning a short video course'), /ADVANCED/);
});
