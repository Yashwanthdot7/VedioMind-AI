const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-key';
process.env.SUPABASE_URL = '';

const textrank = require('../src/services/textrank');
const geminiService = require('../src/services/geminiService');
const lessonService = require('../src/services/lessonService');

const doc = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, '../eval/scene-planning', `${name}.json`), 'utf8'));

test('splits sentences in English and Hindi', () => {
    assert.deepEqual(textrank.splitSentences('Plants make food. They need light! Do animals?'),
        ['Plants make food.', 'They need light!', 'Do animals?'].filter((s) => textrank.words(s).length >= 3));
    const hindi = textrank.splitSentences('लोकतंत्र में सत्ता जनता के हाथ में होती है। चुनाव नियमित समय पर होने चाहिए।');
    assert.equal(hindi.length, 2);
});

test('cuts unpunctuated captions into word windows', () => {
    const captions = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    const parts = textrank.splitSentences(captions);
    assert.equal(parts.length, 8);
    assert.ok(parts.every((p) => p.split(' ').length <= 25));
});

test('scores form a probability distribution and favour central sentences', () => {
    const ranked = textrank.rankSentences(doc('photosynthesis-lecture').text);
    const total = ranked.reduce((s, r) => s + r.score, 0);
    assert.ok(Math.abs(total - 1) < 1e-6);
    const best = [...ranked].sort((a, b) => b.score - a.score)[0];
    assert.match(best.text.toLowerCase(), /photosynthesis|chlorophyll|carbon dioxide|calvin/);
    // The housekeeping opener is not a key sentence
    const opener = ranked.find((r) => r.text.includes('lab reports'));
    assert.ok(opener.score < best.score / 2);
});

test('short material is passed through untouched', () => {
    const out = textrank.planLesson('A short note about volcanoes and magma rising to the surface.', { maxChars: 6000 });
    assert.equal(out.planned, false);
    assert.equal(out.material, 'A short note about volcanoes and magma rising to the surface.');
});

test('long material is condensed within budget, in original order, with one idea per scene', () => {
    const text = doc('water-cycle-notes').text;
    const out = textrank.planLesson(text, { maxChars: 900, sceneCount: 6 });
    assert.equal(out.planned, true);
    assert.ok(out.material.length <= 900);
    assert.equal(out.plan.length, 4);
    // Kept sentences appear in the same order as in the source
    const positions = textrank.splitSentences(out.material).map((s) => text.indexOf(s.slice(0, 40)));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('writeScript sends condensed material and the scene plan for long input', async () => {
    const prompts = [];
    const original = geminiService.withModel;
    geminiService.withModel = async (_o, fn) => fn({
        generateContent: async (prompt) => {
            prompts.push(prompt);
            return { response: { text: () => JSON.stringify({ title: 'T', scenes: [
                { layout: 'title', icon: '🌋', heading: 'A', narration: 'Hello there.', imagePrompt: 'x', bullets: [], highlight: '', leftTitle: '', left: [], rightTitle: '', right: [] },
                { layout: 'summary', icon: '✅', heading: 'B', narration: 'Bye now.', imagePrompt: 'y', bullets: ['a'], highlight: '', leftTitle: '', left: [], rightTitle: '', right: [] },
            ] }) } };
        },
    });
    try {
        const long = Array.from({ length: 6 }, () => doc('photosynthesis-lecture').text).join('\n\n');
        const lesson = await lessonService.writeScript({ material: long, audience: 'student', language: 'en', length: 'short' });
        assert.equal(lesson.planning.method, 'textrank');
        assert.ok(lesson.planning.outputChars <= 6000);
        assert.match(prompts[0], /Suggested key ideas, in order/);
        assert.ok(prompts[0].length < long.length / 2);

        process.env.LESSON_PLANNER = 'off';
        const plain = await lessonService.writeScript({ material: long, audience: 'student', language: 'en', length: 'short' });
        assert.equal(plain.planning.method, 'none');
        assert.ok(prompts[1].includes(long));
    } finally {
        delete process.env.LESSON_PLANNER;
        geminiService.withModel = original;
    }
});
