const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const crypto = require('crypto');

process.env.NODE_ENV = 'test';

// ---- tiny in-memory Supabase stand-in (only what the attempts API uses) ----
const tables = { quiz_attempts: [] };
const USERS = { 'token-alice': { id: '11111111-1111-1111-1111-111111111111' }, 'token-bob': { id: '22222222-2222-2222-2222-222222222222' } };
function query(table) {
    const state = { table, filters: [], op: 'select', payload: null, single: false, order: null, limit: null };
    const api = {
        select() { if (state.op !== 'insert' && state.op !== 'delete') state.op = 'select'; return api; },
        insert(obj) { state.op = 'insert'; state.payload = obj; return api; },
        delete() { state.op = 'delete'; return api; },
        eq(col, val) { state.filters.push([col, val]); return api; },
        order(col, { ascending }) { state.order = [col, ascending]; return api; },
        limit(n) { state.limit = n; return api; },
        single() { state.single = true; return api; },
        then(resolve) {
            const rows = tables[state.table];
            const match = (r) => state.filters.every(([c, v]) => r[c] === v);
            if (state.op === 'insert') {
                const row = { id: crypto.randomUUID(), created_at: new Date(Date.now() + rows.length).toISOString(), ...state.payload };
                rows.push(row);
                return resolve({ data: row, error: null });
            }
            if (state.op === 'delete') {
                tables[state.table] = rows.filter((r) => !match(r));
                return resolve({ data: null, error: null });
            }
            let out = rows.filter(match);
            if (state.order) out = out.sort((a, b) => (a[state.order[0]] < b[state.order[0]] ? 1 : -1));
            if (state.limit) out = out.slice(0, state.limit);
            return resolve({ data: out, error: null });
        },
    };
    return api;
}
const fakeSupabase = {
    from: query,
    auth: { getUser: async (token) => (USERS[token] ? { data: { user: { ...USERS[token], email: 'x@y.z' } }, error: null } : { data: null, error: new Error('bad') }) },
};
const supabasePath = path.join(__dirname, '../src/config/supabase.js');
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: { supabase: fakeSupabase, isSupabaseEnabled: true } };

const { parseAttempt } = require('../src/controllers/attemptController');
const { gradeFor } = require('../src/lib/grades');
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
    return { status: r.status, body: await r.json() };
};

const answers = (pattern) => pattern.map((ok, i) => ({ question: `Q${i}`, chosen: ok ? 1 : 2, answer: 1, difficulty: ['easy', 'medium', 'hard'][i % 3] }));

test('grade scale', () => {
    assert.equal(gradeFor(100), 'A+');
    assert.equal(gradeFor(90), 'A+');
    assert.equal(gradeFor(89), 'A');
    assert.equal(gradeFor(70), 'B');
    assert.equal(gradeFor(60), 'C');
    assert.equal(gradeFor(59), 'D');
    assert.equal(gradeFor(0), 'D');
});

test('score and grade are computed on the server, not trusted from the client', () => {
    const a = parseAttempt({ source: 'lesson', kind: 'test', title: 'T', answers: answers([1, 1, 1, 0, 0]), scorePct: 100, grade: 'A+' });
    assert.equal(a.correct, 3);
    assert.equal(a.total, 5);
    assert.equal(a.score_pct, 60);
    assert.equal(a.grade, 'C');
});

test('rejects malformed attempts', () => {
    assert.throws(() => parseAttempt({ source: 'x', kind: 'quiz', title: 'T', answers: answers([1]) }), { code: 'INVALID_ATTEMPT' });
    assert.throws(() => parseAttempt({ source: 'study', kind: 'quiz', title: '', answers: answers([1]) }), { code: 'INVALID_ATTEMPT' });
    assert.throws(() => parseAttempt({ source: 'study', kind: 'quiz', title: 'T', answers: [] }), { code: 'INVALID_ATTEMPT' });
    assert.throws(() => parseAttempt({ source: 'study', kind: 'quiz', title: 'T', answers: [{ chosen: -1, answer: 0 }] }), { code: 'INVALID_ATTEMPT' });
});

test('requires sign-in', async () => {
    assert.equal((await call('GET', '/quiz-attempts')).status, 401);
    assert.equal((await call('POST', '/quiz-attempts', null, {})).status, 401);
});

test('save, list (newest first), and per-user isolation', async () => {
    const first = await call('POST', '/quiz-attempts', 'token-alice', {
        source: 'study', kind: 'quiz', title: 'Photosynthesis', videoId: 'abcdefghijk', language: 'hi', level: 'kids',
        answers: answers([1, 1, 1, 1, 1, 1, 1, 0]), durationSec: 95.4,
    });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.data.scorePct, 88);
    assert.equal(first.body.data.grade, 'A');
    assert.equal(first.body.data.durationSec, 95);
    assert.equal(first.body.data.language, 'hi');

    await call('POST', '/quiz-attempts', 'token-alice', { source: 'lesson', kind: 'test', title: 'Volcanoes', answers: answers([1, 0, 0, 0]) });
    await call('POST', '/quiz-attempts', 'token-bob', { source: 'lesson', kind: 'quick', title: 'Bob', answers: answers([1]) });

    const alice = await call('GET', '/quiz-attempts', 'token-alice');
    assert.equal(alice.body.data.length, 2);
    assert.equal(alice.body.data[0].title, 'Volcanoes', 'newest first');
    assert.equal(alice.body.data[0].grade, 'D');
    assert.ok(alice.body.data.every((a) => a.title !== 'Bob'));

    const bob = await call('GET', '/quiz-attempts', 'token-bob');
    assert.equal(bob.body.data.length, 1);
});

test('delete one and clear all only touch your own history', async () => {
    const alice = await call('GET', '/quiz-attempts', 'token-alice');
    await call('DELETE', `/quiz-attempts/${alice.body.data[0].id}`, 'token-alice');
    assert.equal((await call('GET', '/quiz-attempts', 'token-alice')).body.data.length, 1);

    // Bob can't delete Alice's attempt
    const remaining = (await call('GET', '/quiz-attempts', 'token-alice')).body.data[0];
    await call('DELETE', `/quiz-attempts/${remaining.id}`, 'token-bob');
    assert.equal((await call('GET', '/quiz-attempts', 'token-alice')).body.data.length, 1);

    await call('DELETE', '/quiz-attempts', 'token-alice');
    assert.equal((await call('GET', '/quiz-attempts', 'token-alice')).body.data.length, 0);
    assert.equal((await call('GET', '/quiz-attempts', 'token-bob')).body.data.length, 1);
});
