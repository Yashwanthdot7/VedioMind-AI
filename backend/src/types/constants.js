const GEMINI_MODELS = {
    TEXT: 'gemini-2.5-flash',
};

const PROMPTS = {
    SUMMARY: `You are an expert video content analyzer. Your task is to provide a comprehensive yet concise summary of the following YouTube video.

Title: {title}
Transcript: {transcript}

Please provide:
1. A high-level overview (2-3 sentences).
2. Key discussion points.
3. A concluding summary.

Focus on the most important information and maintain a professional tone.`,

    KEY_TAKEAWAYS: `Analyze the following video transcript and extract the most important "Key Takeaways".

Transcript: {transcript}

Return the results as a JSON array of strings, for example:
["Takeaway 1", "Takeaway 2", "Takeaway 3"]

Ensure the takeaways are actionable and insightful.`,

    CHAT: `You are VideoMind AI, a helpful assistant that answers questions about YouTube videos based on their transcripts and summaries.

Video Title: {title}
Summary: {summary}
Transcript Context: {transcript}

User Question: {question}

Please answer the question accurately based on the provided context. If the information is not present in the context, politely inform the user.`,
};

module.exports = {
    GEMINI_MODELS,
    PROMPTS,
};
