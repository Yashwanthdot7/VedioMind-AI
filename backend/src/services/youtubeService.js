const ytdl = require('@distube/ytdl-core');
const { YoutubeTranscript } = require('youtube-transcript');
const AppError = require('../lib/AppError');

// Merge short caption lines into readable segments of roughly this length
const SEGMENT_TARGET_SECONDS = 15;

const HTML_ENTITIES = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

/** Captions often arrive double-encoded, e.g. "&amp;#39;" */
function decodeEntities(text) {
    let out = String(text || '');
    for (let i = 0; i < 2; i += 1) {
        out = out
            .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => HTML_ENTITIES[m] ?? m)
            .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
            .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    }
    return out.replace(/\s+/g, ' ').trim();
}

/** 75 -> "1:15", 3725 -> "1:02:05" */
function formatTimestamp(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const ss = secs.toString().padStart(2, '0');
    return hours > 0 ? `${hours}:${mins.toString().padStart(2, '0')}:${ss}` : `${mins}:${ss}`;
}

class YouTubeService {
    async getVideoInfo(videoId) {
        try {
            const info = await ytdl.getBasicInfo(videoId);
            const d = info.videoDetails;
            const thumbs = d.thumbnails || [];
            return {
                videoId,
                title: d.title,
                duration: parseInt(d.lengthSeconds, 10) || null,
                author: d.author?.name || d.ownerChannelName || null,
                thumbnail: thumbs.length ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            };
        } catch (error) {
            console.warn('ytdl getBasicInfo failed, falling back to oEmbed:', error.message);
            return this.getVideoInfoFromOEmbed(videoId);
        }
    }

    /** Lightweight fallback when ytdl breaks (it often does after YouTube changes) */
    async getVideoInfoFromOEmbed(videoId) {
        try {
            const res = await fetch(
                `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
            );
            if (!res.ok) throw new Error(`oEmbed ${res.status}`);
            const data = await res.json();
            return {
                videoId,
                title: data.title,
                duration: null,
                author: data.author_name || null,
                thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            };
        } catch (error) {
            throw new AppError(
                'Could not find that video. It may be private, age-restricted or removed.',
                404,
                'VIDEO_NOT_FOUND',
            );
        }
    }

    /**
     * Returns [{ text, timestamp, seconds }] merged into ~15s segments.
     */
    async getTranscript(videoId, durationSeconds = null) {
        let items;
        try {
            items = await YoutubeTranscript.fetchTranscript(videoId);
        } catch (error) {
            const name = error?.constructor?.name || '';
            console.warn(`Transcript fetch failed (${name}):`, error.message);
            if (name.includes('TooManyRequest')) {
                throw new AppError('YouTube is rate-limiting us right now. Please try again in a few minutes.', 503, 'YOUTUBE_RATE_LIMITED');
            }
            throw new AppError(
                'This video has no captions available, so it can\'t be processed yet. Try a video with subtitles/CC.',
                422,
                'NO_TRANSCRIPT',
            );
        }

        if (!Array.isArray(items) || items.length === 0) {
            throw new AppError(
                'This video has no captions available, so it can\'t be processed yet. Try a video with subtitles/CC.',
                422,
                'NO_TRANSCRIPT',
            );
        }

        // youtube-transcript returns seconds; guard against a future switch to milliseconds
        const maxOffset = Math.max(...items.map((i) => Number(i.offset) || 0));
        const looksLikeMs = durationSeconds
            ? maxOffset > durationSeconds * 5
            : maxOffset > 24 * 3600;
        const toSeconds = (v) => (Number(v) || 0) / (looksLikeMs ? 1000 : 1);

        return this.mergeSegments(items.map((i) => ({
            start: toSeconds(i.offset),
            text: decodeEntities(i.text),
        })).filter((i) => i.text));
    }

    mergeSegments(lines) {
        const segments = [];
        let current = null;

        for (const line of lines) {
            if (!current) {
                current = { start: line.start, parts: [line.text] };
                continue;
            }
            const longEnough = line.start - current.start >= SEGMENT_TARGET_SECONDS;
            const prev = current.parts[current.parts.length - 1];
            const sentenceEnded = /[.!?।]$/.test(prev);
            if (longEnough && (sentenceEnded || line.start - current.start >= SEGMENT_TARGET_SECONDS * 2)) {
                segments.push(current);
                current = { start: line.start, parts: [line.text] };
            } else {
                current.parts.push(line.text);
            }
        }
        if (current) segments.push(current);

        return segments.map((s) => ({
            text: s.parts.join(' '),
            seconds: Math.floor(s.start),
            timestamp: formatTimestamp(s.start),
        }));
    }

    getFullTranscriptText(transcript) {
        return transcript.map((item) => item.text).join(' ');
    }
}

module.exports = new YouTubeService();
module.exports.formatTimestamp = formatTimestamp;
module.exports.decodeEntities = decodeEntities;
