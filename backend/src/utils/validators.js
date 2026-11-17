const AppError = require('../lib/AppError');
const { isSupportedLanguage, DEFAULT_LANGUAGE } = require('../config/languages');

const VIDEO_ID_RE = /^[\w-]{11}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_URL_LENGTH = 500;
const MAX_QUESTION_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 30;

/**
 * Extract an 11-character YouTube video ID from any common URL format
 * (watch, youtu.be, embed, shorts, live, m.youtube) or a bare ID.
 */
function extractVideoId(input) {
    if (typeof input !== 'string' || !input.trim() || input.length > MAX_URL_LENGTH) {
        throw new AppError('Please provide a valid YouTube URL', 400, 'INVALID_URL');
    }
    const value = input.trim();
    if (VIDEO_ID_RE.test(value)) return value;

    let url;
    try {
        url = new URL(value.startsWith('http') ? value : `https://${value}`);
    } catch {
        throw new AppError('Please provide a valid YouTube URL', 400, 'INVALID_URL');
    }

    const host = url.hostname.replace(/^www\.|^m\.|^music\./, '');
    let id = null;

    if (host === 'youtu.be') {
        id = url.pathname.split('/')[1];
    } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        if (url.pathname === '/watch') {
            id = url.searchParams.get('v');
        } else {
            const match = url.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/);
            if (match) id = match[2];
        }
    }

    if (!id || !VIDEO_ID_RE.test(id)) {
        throw new AppError('That doesn\'t look like a YouTube video link', 400, 'INVALID_URL');
    }
    return id;
}

function parseLanguage(code) {
    if (code === undefined || code === null || code === '') return DEFAULT_LANGUAGE;
    if (!isSupportedLanguage(code)) {
        throw new AppError(`Unsupported language: ${code}`, 400, 'INVALID_LANGUAGE');
    }
    return code;
}

function isUuid(value) {
    return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Validate and trim a chat history array: [{role, content}]
 */
function parseMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new AppError('At least one message is required', 400, 'INVALID_MESSAGES');
    }
    const cleaned = messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_QUESTION_LENGTH) }))
        .filter((m) => m.content.length > 0)
        .slice(-MAX_HISTORY_MESSAGES);

    if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== 'user') {
        throw new AppError('The last message must be a question from the user', 400, 'INVALID_MESSAGES');
    }
    return cleaned;
}

module.exports = {
    extractVideoId,
    parseLanguage,
    parseMessages,
    isUuid,
    MAX_QUESTION_LENGTH,
};
