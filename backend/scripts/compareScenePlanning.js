#!/usr/bin/env node
/**
 * Measured comparison: what should the lesson writer read when the material is too long?
 *
 *   node scripts/compareScenePlanning.js            offline: selection quality (no API key, free, instant)
 *   node scripts/compareScenePlanning.js --live     also writes real lessons with Gemini, with and without
 *                                                   TextRank, and compares prompt size, speed and coverage
 *   add --write to save the tables to eval/scene-planning/RESULTS.md
 *
 * Each file in eval/scene-planning/ has a long text plus the key points a good lesson must
 * cover, written by hand. All methods get the same character budget (a share of the text,
 * which is what happens to a 40-minute transcript against a 6,000-character budget).
 *
 * Methods
 *   first part   keep sentences from the start until the budget is used (plain truncation)
 *   evenly       keep sentences spaced evenly through the text
 *   random       keep random sentences (mean of 30 runs)
 *   textrank     keep the highest-ranked sentences, in document order
 *
 * Metrics (higher is better)
 *   ROUGE-1 / ROUGE-2 recall   share of the key points' words / word pairs found in the selection
 *   key points covered         a key point counts if at least half of its content words appear
 *   plan hits                  key points matched by the suggested scene ideas (one per scene)
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const textrank = require('../src/services/textrank');

const DIR = path.join(__dirname, '../eval/scene-planning');
const BUDGETS = [0.25, 0.4];
const SCENES = 6;
const args = new Set(process.argv.slice(2));

// ------------------------------------------------------------ helpers

function mulberry32(seed) {
    return () => {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const toks = (s) => textrank.words(s);
const bigrams = (t) => t.slice(1).map((w, i) => `${t[i]} ${w}`);

function recall(refTokens, candTokens) {
    if (!refTokens.length) return 0;
    const pool = new Map();
    for (const t of candTokens) pool.set(t, (pool.get(t) || 0) + 1);
    let hit = 0;
    for (const t of refTokens) {
        const c = pool.get(t);
        if (c) { hit += 1; pool.set(t, c - 1); }
    }
    return hit / refTokens.length;
}

function covered(point, text) {
    const have = new Set(toks(text));
    const need = [...new Set(toks(point))];
    return need.length > 0 && need.filter((w) => have.has(w)).length / need.length >= 0.5;
}

function score(doc, selectedText, plan) {
    const ref = doc.keyPoints.join(' ');
    const cand = toks(selectedText);
    return {
        r1: recall(toks(ref), cand),
        r2: recall(bigrams(toks(ref)), bigrams(cand)),
        cover: doc.keyPoints.filter((p) => covered(p, selectedText)).length / doc.keyPoints.length,
        plan: doc.keyPoints.filter((p) => plan.some((idea) => covered(p, idea))).length / doc.keyPoints.length,
    };
}

function fillInOrder(sentences, order, budget) {
    const chosen = [];
    let used = 0;
    for (const i of order) {
        const len = sentences[i].text.length + 1;
        if (used + len > budget) continue;
        chosen.push(i);
        used += len;
    }
    return chosen.sort((a, b) => a - b).map((i) => sentences[i].text);
}

/** One idea per scene from a list of chosen sentences: take evenly spaced ones */
function spacedIdeas(list, n) {
    if (list.length <= n) return list;
    return Array.from({ length: n }, (_, k) => list[Math.floor((k * list.length) / n)]);
}

const IDEAS = SCENES - 2;

const METHODS = {
    'first part': (ranked, budget) => {
        const kept = fillInOrder(ranked, ranked.map((_, i) => i), budget);
        return { text: kept.join(' '), plan: kept.slice(0, IDEAS) };
    },
    evenly: (ranked, budget) => {
        const n = ranked.length;
        const avg = ranked.reduce((s, x) => s + x.text.length + 1, 0) / n;
        const k = Math.max(1, Math.floor(budget / avg));
        const order = [...new Set(Array.from({ length: k }, (_, j) => Math.floor(((j + 0.5) * n) / k)))];
        const kept = fillInOrder(ranked, order, budget);
        return { text: kept.join(' '), plan: spacedIdeas(kept, IDEAS) };
    },
    random: (ranked, budget, seed) => {
        const rand = mulberry32(seed);
        const order = ranked.map((_, i) => i).sort(() => rand() - 0.5);
        const kept = fillInOrder(ranked, order, budget);
        return { text: kept.join(' '), plan: spacedIdeas(kept, IDEAS) };
    },
    textrank: (ranked, budget, _seed, doc) => {
        const result = textrank.planLesson(doc.text, { maxChars: budget, sceneCount: SCENES });
        return { text: result.material, plan: result.plan };
    },
};

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (x) => `${Math.round(x * 100)}%`;
const f2 = (x) => x.toFixed(3);

// ------------------------------------------------------------ offline comparison

function offline(docs) {
    const lines = [];
    for (const share of BUDGETS) {
        const rows = {};
        for (const name of Object.keys(METHODS)) rows[name] = [];
        for (const doc of docs) {
            const ranked = textrank.rankSentences(doc.text);
            const budget = Math.floor(doc.text.length * share);
            for (const [name, fn] of Object.entries(METHODS)) {
                if (name === 'random') {
                    const runs = Array.from({ length: 30 }, (_, s) => score(doc, ...Object.values(fn(ranked, budget, s + 1))));
                    rows[name].push({ r1: mean(runs.map((r) => r.r1)), r2: mean(runs.map((r) => r.r2)), cover: mean(runs.map((r) => r.cover)), plan: mean(runs.map((r) => r.plan)) });
                } else {
                    const out = fn(ranked, budget, 0, doc);
                    rows[name].push(score(doc, out.text, out.plan));
                }
            }
        }
        lines.push(`### Budget: ${Math.round(share * 100)}% of the text (${docs.length} documents, ${SCENES}-scene lessons)\n`);
        lines.push('| Method | ROUGE-1 recall | ROUGE-2 recall | Key points covered | Plan hits |');
        lines.push('|---|---:|---:|---:|---:|');
        for (const [name, list] of Object.entries(rows)) {
            const label = name === 'textrank' ? '**TextRank**' : name;
            lines.push(`| ${label} | ${f2(mean(list.map((r) => r.r1)))} | ${f2(mean(list.map((r) => r.r2)))} | ${pct(mean(list.map((r) => r.cover)))} | ${pct(mean(list.map((r) => r.plan)))} |`);
        }
        lines.push('');
        // Per document, TextRank vs plain truncation (what the app did before)
        lines.push('| Document | Kind | Key points covered: first part → TextRank |');
        lines.push('|---|---|---|');
        docs.forEach((doc, i) => {
            lines.push(`| ${doc.title} | ${doc.kind} | ${pct(rows['first part'][i].cover)} → ${pct(rows.textrank[i].cover)} |`);
        });
        lines.push('');
    }
    return lines.join('\n');
}

// ------------------------------------------------------------ live comparison (uses Gemini)

async function live(docs) {
    const geminiService = require('../src/services/geminiService');
    const lessonService = require('../src/services/lessonService');
    const share = 0.25;
    const rows = [];
    for (const doc of docs) {
        const language = doc.language || (/[ऀ-ॿ]/.test(doc.text) ? 'hi' : 'en');
        const budget = Math.floor(doc.text.length * share);
        const truncated = doc.text.slice(0, budget);
        const planned = textrank.planLesson(doc.text, { maxChars: budget, sceneCount: SCENES });
        const variants = {
            'full text': { material: doc.text, plan: [] },
            'first part': { material: truncated, plan: [] },
            textrank: { material: planned.material, plan: planned.plan },
        };
        for (const [name, v] of Object.entries(variants)) {
            const started = Date.now();
            const { text, usage } = await geminiService.withModel({
                generationConfig: { responseMimeType: 'application/json', responseSchema: lessonService.LESSON_SCHEMA, temperature: 0.2 },
            }, async (model) => {
                const r = await model.generateContent(lessonService.buildPrompt({ material: v.material, audience: 'student', language, length: 'short', plan: v.plan }));
                return { text: r.response.text(), usage: r.response.usageMetadata };
            });
            const lesson = lessonService.normalise(JSON.parse(text));
            const spoken = lesson.scenes.map((s) => `${s.heading} ${s.narration} ${s.bullets.join(' ')}`).join(' ');
            rows.push({ doc: doc.title, name, ms: Date.now() - started, tokens: usage?.promptTokenCount || 0, cover: doc.keyPoints.filter((p) => covered(p, spoken)).length / doc.keyPoints.length });
            process.stderr.write('.');
            await new Promise((r) => setTimeout(r, 4000)); // stay under the free per-minute limit
        }
    }
    process.stderr.write('\n');
    const lines = ['### Live: real lessons written by Gemini (budget 25%, temperature 0.2)\n', '| Input | Prompt tokens (mean) | Time to write (mean) | Key points in the finished lesson |', '|---|---:|---:|---:|'];
    for (const name of ['full text', 'first part', 'textrank']) {
        const r = rows.filter((x) => x.name === name);
        lines.push(`| ${name === 'textrank' ? '**TextRank**' : name} | ${Math.round(mean(r.map((x) => x.tokens)))} | ${(mean(r.map((x) => x.ms)) / 1000).toFixed(1)} s | ${pct(mean(r.map((x) => x.cover)))} |`);
    }
    return lines.join('\n');
}

// ------------------------------------------------------------ main

(async () => {
    const docs = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
        .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
    let report = `## Scene planning: measured comparison\n\nGenerated by \`node scripts/compareScenePlanning.js${args.has('--live') ? ' --live' : ''}\` on ${new Date().toISOString().slice(0, 10)}.\n\n${offline(docs)}`;
    if (args.has('--live')) {
        if (!process.env.GEMINI_API_KEY) {
            console.error('--live needs GEMINI_API_KEY in backend/.env');
            process.exit(1);
        }
        report += `\n${await live(docs)}\n`;
    }
    console.log(report);
    if (args.has('--write')) {
        fs.writeFileSync(path.join(DIR, 'RESULTS.md'), `${report}\n`);
        console.log(`Saved to ${path.relative(process.cwd(), path.join(DIR, 'RESULTS.md'))}`);
    }
})().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
