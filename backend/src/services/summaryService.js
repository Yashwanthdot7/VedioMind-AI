const AppError = require('../lib/AppError');
const geminiService = require('./geminiService');
const { formatTranscript, wrapGeminiError, ANALYSIS_SCHEMA } = require('./geminiService');
const { languageName } = require('../config/languages');
const { LEVELS, LEVEL_GUIDANCE } = require('../config/learner');
const store = require('./analysisStore');
const { MemoryCache } = require('../lib/memoryCache');

/**
 * The shared analysis of a video is written for an intermediate learner and cached once
 * per video + language for everyone. Beginners and advanced learners get the summary
 * rewritten for their level: one small extra call, cached per level.
 */

const cache = new MemoryCache({ maxEntries: 200 });
const inFlight = new Map();

function buildPrompt({ context, level, language }) {
    return `Rewrite this video's summary and key takeaways for a different learner.

${LEVEL_GUIDANCE[level]}

Keep the same structure: a short overview paragraph, then "- " bullet points with **bold** key terms, then a one-line conclusion. Give 5 to 7 key takeaways.
Keep every [m:ss] timestamp that is still relevant, and only use timestamps that appear in the transcript.
Write in ${languageName(language)}. Base everything on the video only.

Video title: ${context.title}

Current summary:
${context.summary}

Transcript (excerpt):
${formatTranscript(context.transcript, 30000)}`;
}

/**
 * @returns {Promise<{ summary: string, keyTakeaways: string[], level: string }>}
 * "intermediate" returns the shared analysis unchanged.
 */
async function forLevel({ context, level, language }) {
    if (!LEVELS.includes(level)) throw new AppError(`Unknown level: ${level}`, 400, 'INVALID_LEVEL');
    if (level === 'intermediate') return { summary: context.summary, keyTakeaways: context.keyTakeaways || [], level };

    const key = `${context.analysisId || context.videoId}:${language}:${level}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const saved = await store.getStudyMaterial(context.analysisId, 'summary', language, level);
    if (saved?.data?.summary) {
        cache.set(key, saved.data);
        return saved.data;
    }

    if (!inFlight.has(key)) {
        inFlight.set(key, (async () => {
            let raw;
            try {
                raw = await geminiService.withModel({
                    generationConfig: { responseMimeType: 'application/json', responseSchema: ANALYSIS_SCHEMA, temperature: 0.4 },
                }, async (model) => (await model.generateContent(buildPrompt({ context, level, language }))).response.text());
            } catch (error) {
                throw wrapGeminiError(error, 'Could not adapt the summary to your level. Please try again.');
            }
            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch {
                throw new AppError('The AI returned an unexpected summary. Please try again.', 502, 'AI_BAD_OUTPUT');
            }
            const result = {
                summary: String(parsed.summary || '').trim() || context.summary,
                keyTakeaways: (Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : []).map(String).filter(Boolean).slice(0, 8),
                level,
            };
            cache.set(key, result);
            await store.saveStudyMaterial(context.analysisId, 'summary', language, level, result);
            return result;
        })().finally(() => inFlight.delete(key)));
    }
    return inFlight.get(key);
}

module.exports = { forLevel, buildPrompt };
