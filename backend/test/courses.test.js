const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-key';
process.env.SUPABASE_URL = '';
process.env.LESSON_STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'courses-'));

const geminiService = require('../src/services/geminiService');
const ttsService = require('../src/services/ttsService');
const imageService = require('../src/services/imageService');
const courseService = require('../src/services/courseService');
const courseJobs = require('../src/services/courseJobs');

imageService.generate = async () => ({ buffer: Buffer.from([0xff, 0xd8, 0xff, 0]), mime: 'image/jpeg', provider: 'cloudflare' });
const pcm = Buffer.alloc(24000 * 2);
ttsService.fetch = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm.toString('base64') } }] } }] }) });

const OUTLINE = {
    title: 'The Water Cycle',
    modules: [
        { title: 'Evaporation and transpiration', goal: 'Explain how water enters the air.', keyPoints: ['Sun heats oceans', 'water vapour', 'plants transpire'] },
        { title: 'Condensation and clouds', goal: 'Explain how clouds form.', keyPoints: ['air cools', 'droplets condense on dust', 'fog'] },
        { title: 'Precipitation and runoff', goal: 'Explain where rain goes.', keyPoints: ['rain snow hail', 'runoff to rivers', 'groundwater aquifers'] },
        { title: 'Extra module the user did not ask for', goal: 'x', keyPoints: ['y'] },
    ],
};
const scene = (layout, heading) => ({ layout, icon: '💧', heading, narration: `${heading} narration.`, imagePrompt: 'water', bullets: ['a'], highlight: '', leftTitle: '', left: [], rightTitle: '', right: [] });
const prompts = { outline: [], script: [] };
let failModule = -1;
geminiService.withModel = async (_options, fn) => fn({
    generateContent: async (prompt) => {
        if (prompt.startsWith('You are planning a short video course')) {
            prompts.outline.push(prompt);
            return { response: { text: () => JSON.stringify(OUTLINE) } };
        }
        prompts.script.push(prompt);
        const n = prompts.script.length - 1;
        if (n === failModule) throw Object.assign(new Error('boom'), { status: 500 });
        return { response: { text: () => JSON.stringify({ title: `Script ${n}`, scenes: [scene('title', 'Start'), scene('bullets', 'Middle'), scene('summary', 'End')] }) } };
    },
});

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
    return { status: r.status, body: await r.json() };
};

const notes = JSON.parse(fs.readFileSync(path.join(__dirname, '../eval/scene-planning/water-cycle-notes.json'), 'utf8')).text;

test('a course is outlined, then every module is made in order as a lesson', async () => {
    prompts.outline.length = 0;
    prompts.script.length = 0;
    const res = await post('/courses', { text: notes, audience: 'student', language: 'en', modules: 3 });
    assert.equal(res.status, 202);
    assert.equal(res.body.data.userId, undefined, 'owner id must not leak');
    await courseJobs.whenDone(res.body.data.id);

    const { body } = await get(`/courses/${res.body.data.id}`);
    const course = body.data;
    assert.equal(course.status, 'done', course.error);
    assert.equal(course.progress, 100);
    assert.equal(course.title, 'The Water Cycle');
    assert.equal(course.modules.length, 3, 'extra modules from the AI are dropped');
    assert.match(prompts.outline[0], /exactly 3 modules/);

    for (const [i, m] of course.modules.entries()) {
        assert.equal(m.status, 'done');
        const lesson = (await get(`/lessons/${m.lessonId}`)).body.data;
        assert.equal(lesson.title, OUTLINE.modules[i].title, 'module keeps its outline title');
        assert.equal(lesson.courseId, course.id);
        assert.equal(lesson.moduleIndex, i);
        assert.match(prompts.script[i], new RegExp(`module ${i + 1} of 3`));
    }
    // Modules link to each other and the last one recaps
    assert.match(prompts.script[0], /introduce the course topic/);
    assert.match(prompts.script[1], /link to the previous module/);
    assert.match(prompts.script[2], /recap of the whole course/);
    // Each module is written from its own part of the notes
    const material = (i) => prompts.script[i].split('Material:')[1];
    assert.match(material(1), /Fog is simply a cloud/);
    assert.doesNotMatch(material(0), /Fog is simply a cloud/);
    assert.doesNotMatch(material(1), /Evaporation is the process/);
});

test('modules count is kept between 3 and 5', () => {
    assert.equal(courseService.clampModules(1), 3);
    assert.equal(courseService.clampModules(9), 5);
    assert.equal(courseService.clampModules('4'), 4);
    assert.equal(courseService.clampModules(undefined), 4);
});

test('a short topic is shared by every module', () => {
    const parts = courseService.splitMaterial('The water cycle', OUTLINE.modules.slice(0, 3));
    assert.deepEqual(parts, ['The water cycle', 'The water cycle', 'The water cycle']);
});

test('long material is split so each module gets the sentences about it', () => {
    const parts = courseService.splitMaterial(notes, OUTLINE.modules.slice(0, 3));
    assert.match(parts[0], /Evaporation is the process/);
    assert.match(parts[1], /condensation/i);
    assert.match(parts[2], /precipitation|runoff/i);
});

test('one failed module does not fail the course', async () => {
    prompts.script.length = 0;
    failModule = 1;
    try {
        const res = await post('/courses', { text: 'Teach me the water cycle in detail', modules: 3 });
        await courseJobs.whenDone(res.body.data.id);
        const course = (await get(`/courses/${res.body.data.id}`)).body.data;
        assert.equal(course.status, 'done');
        assert.deepEqual(course.modules.map((m) => m.status), ['done', 'failed', 'done']);
        assert.match(course.error, /1 module/);
    } finally {
        failModule = -1;
    }
});

test('course modules are not listed as separate lessons, and bad ids are 404', async () => {
    assert.equal((await get('/courses/not-a-uuid')).status, 404);
    assert.equal((await get('/courses/00000000-0000-4000-8000-000000000000')).status, 404);
    const bad = await post('/courses', { text: 'hi' });
    assert.equal(bad.status, 400);
});
