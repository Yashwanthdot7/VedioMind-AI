/**
 * TextRank (Mihalcea & Tarau, 2004) for picking the key sentences of long lesson
 * material, in any language. No dependencies, no API calls, runs in milliseconds.
 *
 *  1. Split the text into sentences (Latin, Devanagari danda, Arabic, CJK punctuation).
 *     Auto-generated captions have no punctuation, so very long runs are cut into
 *     ~25-word windows instead.
 *  2. Link every pair of sentences by word overlap, normalised by length:
 *        sim(a, b) = |words(a) ∩ words(b)| / (log|a| + log|b|)
 *  3. Run PageRank on that graph. A sentence ranks high when it shares words with
 *     many other important sentences, i.e. it states a central idea.
 */

const SENTENCE_END = /(?<=[.!?।॥؟。！？])\s+|\n{2,}/u;
const WINDOW_WORDS = 25;
const LONG_RUN_WORDS = 60;

// Small English stop list; for other languages the length normalisation does the work
const STOP = new Set(`a an the and or but if then so of to in on at by for with from as is are was were be been being
it its this that these those there here we you they he she i me my our your their his her them us do does did done
have has had not no yes can could will would should may might must just very also about into over under than too
what which who whom when where why how all any each few more most other some such only own same up down out off
again further once um uh like okay ok right so well now let lets going gonna get got see`.split(/\s+/));

function words(sentence) {
    return (sentence.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || [])
        .filter((w) => w.length > 1 && !STOP.has(w));
}

/** @returns {string[]} */
function splitSentences(text) {
    const out = [];
    for (const raw of String(text || '').split(SENTENCE_END)) {
        const s = raw.replace(/\s+/g, ' ').trim();
        if (!s) continue;
        const tokens = s.split(' ');
        if (tokens.length <= LONG_RUN_WORDS) {
            out.push(s);
            continue;
        }
        // Unpunctuated captions: fixed windows keep the graph meaningful
        for (let i = 0; i < tokens.length; i += WINDOW_WORDS) out.push(tokens.slice(i, i + WINDOW_WORDS).join(' '));
    }
    return out.filter((s) => words(s).length >= 3);
}

function similarity(a, b) {
    if (a.size < 2 || b.size < 2) return 0;
    let shared = 0;
    for (const w of a) if (b.has(w)) shared += 1;
    return shared ? shared / (Math.log(a.size) + Math.log(b.size)) : 0;
}

/**
 * Score every sentence with PageRank over the similarity graph.
 * @returns {{ index: number, text: string, score: number }[]} in document order
 */
function rankSentences(text, { damping = 0.85, iterations = 50, tolerance = 1e-6 } = {}) {
    const sentences = splitSentences(text);
    const n = sentences.length;
    if (n === 0) return [];
    const bags = sentences.map((s) => new Set(words(s)));

    const weights = Array.from({ length: n }, () => new Float64Array(n));
    const outSum = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            const w = similarity(bags[i], bags[j]);
            if (w > 0) {
                weights[i][j] = w;
                weights[j][i] = w;
                outSum[i] += w;
                outSum[j] += w;
            }
        }
    }

    let scores = new Float64Array(n).fill(1 / n);
    for (let it = 0; it < iterations; it += 1) {
        const next = new Float64Array(n).fill((1 - damping) / n);
        for (let j = 0; j < n; j += 1) {
            if (!outSum[j]) {
                // Isolated sentence: spread its score evenly (keeps the total at 1)
                for (let i = 0; i < n; i += 1) next[i] += (damping * scores[j]) / n;
                continue;
            }
            for (let i = 0; i < n; i += 1) {
                if (weights[j][i]) next[i] += damping * scores[j] * (weights[j][i] / outSum[j]);
            }
        }
        let delta = 0;
        for (let i = 0; i < n; i += 1) delta += Math.abs(next[i] - scores[i]);
        scores = next;
        if (delta < tolerance) break;
    }

    return sentences.map((s, index) => ({ index, text: s, score: scores[index] }));
}

/** Keep the best sentences, in their original order, until the character budget is used up */
function selectWithinBudget(ranked, maxChars) {
    const chosen = [];
    let used = 0;
    for (const s of [...ranked].sort((a, b) => b.score - a.score)) {
        if (used + s.text.length + 1 > maxChars) continue;
        chosen.push(s);
        used += s.text.length + 1;
    }
    return chosen.sort((a, b) => a.index - b.index);
}

/**
 * Condense long material to its key sentences and outline one key idea per scene.
 * Short material is returned unchanged (the model can read all of it).
 *
 * @param {string} text
 * @param {{ maxChars?: number, sceneCount?: number }} options
 * @returns {{ planned: boolean, material: string, plan: string[], stats: object }}
 */
function planLesson(text, { maxChars = 6000, sceneCount = 6 } = {}) {
    const source = String(text || '');
    const ranked = rankSentences(source);
    if (source.length <= maxChars || ranked.length < sceneCount * 2) {
        return { planned: false, material: source, plan: [], stats: { sentences: ranked.length, inputChars: source.length, outputChars: source.length } };
    }

    const kept = selectWithinBudget(ranked, maxChars);
    const material = kept.map((s) => s.text).join(' ');

    // Scene plan: split the document into equal parts and take the top sentence of each,
    // so the lesson covers the whole material in order rather than one dense section
    const ideas = Math.max(2, sceneCount - 2); // the title and summary scenes don't need one
    const plan = [];
    for (let k = 0; k < ideas; k += 1) {
        const from = Math.floor((k * ranked.length) / ideas);
        const to = Math.floor(((k + 1) * ranked.length) / ideas);
        const best = ranked.slice(from, to).sort((a, b) => b.score - a.score)[0];
        if (best) plan.push(best.text.length > 220 ? `${best.text.slice(0, 217)}…` : best.text);
    }

    return {
        planned: true,
        material,
        plan,
        stats: { sentences: ranked.length, kept: kept.length, inputChars: source.length, outputChars: material.length },
    };
}

module.exports = { splitSentences, words, rankSentences, selectWithinBudget, planLesson };
