// Tried in order until one works (Google retires model names regularly).
// Set GEMINI_MODEL in .env to put your own choice first.
const MODEL_CANDIDATES = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'];

const LIMITS = {
    // Flash models have a very large context window; this keeps cost and latency sane
    TRANSCRIPT_CHARS: 300000,
    CHAT_TRANSCRIPT_CHARS: 200000,
    MAX_TAKEAWAYS: 7,
    // Longest video the AI fallback will transcribe (free tier: 8h of YouTube video per day)
    AI_TRANSCRIBE_MAX_SECONDS: 90 * 60,
};

const PROMPTS = {
    TRANSCRIBE: `Transcribe the speech in this video.

- Write exactly what is said, in the language it is spoken. Do not translate or summarise.
- Group the speech into segments of about 10-20 seconds, ending at natural sentence breaks.
- "start" is when the segment begins, in whole seconds from the start of the video.
- If there is no speech (music only), describe what is shown in short segments instead.

Return a JSON array of {"start": number, "text": string}.`,

    ANALYZE: `You are an expert video content analyst. Analyse the YouTube video below using its transcript.
Each transcript line starts with a [m:ss] timestamp.

Write ALL output in {language}, even if the transcript is in another language.

Return JSON with:
- "summary": Markdown. Start with a 2-3 sentence overview paragraph. Then a blank line and the key discussion points as "- " bullet points (use **bold** for key terms). Then a blank line and a one-paragraph conclusion. No headings.
- "keyTakeaways": 5 to 7 concise, actionable, insightful takeaways (plain text, one sentence each).

Video title: {title}

Transcript:
{transcript}`,

    CHAT_SYSTEM: `You are VideoMind AI, a friendly assistant that answers questions about one YouTube video, using its transcript and summary below.

Rules:
- Reply in {language} unless the user clearly writes in another language; then reply in their language.
- Base answers on the video. If the video doesn't cover something, say so briefly, then you may add general knowledge clearly marked as not from the video.
- When you refer to a specific part of the video, cite its timestamp in square brackets exactly like [4:32] so the user can jump there.
- Keep answers clear and well structured. Use short paragraphs or "- " bullet points.

Video title: {title}

Summary:
{summary}

Transcript (each line starts with a [m:ss] timestamp):
{transcript}`,
};

module.exports = { MODEL_CANDIDATES, LIMITS, PROMPTS };
