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
            console.warn('ytdl getBasicInfo failed, trying youtubei.js:', error.message);
        }
        try {
            return await this.getVideoInfoFromInnertube(videoId);
        } catch (error) {
            console.warn('youtubei.js info failed, falling back to oEmbed:', error.message);
        }
        return this.getVideoInfoFromOEmbed(videoId);
    }

    async getInnertube() {
        const { Innertube } = await import('youtubei.js');
        if (!this.innertube) {
            this.innertube = Innertube.create({ retrieve_player: false, generate_session_locally: true })
                .catch((err) => { this.innertube = null; throw err; });
        }
        return this.innertube;
    }

    async getVideoInfoFromInnertube(videoId) {
        const yt = await this.getInnertube();
        const info = await yt.getBasicInfo(videoId);
        const b = info.basic_info || {};
        if (!b.title) throw new Error('no title');
        const thumbs = b.thumbnail || [];
        return {
            videoId,
            title: b.title,
            duration: Number(b.duration) || null,
            author: b.author || b.channel?.name || null,
            thumbnail: thumbs[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        };
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
     * Tries several caption sources because YouTube regularly breaks scrapers.
     * Throws AppError NO_TRANSCRIPT if none of them work (the controller can
     * then fall back to Gemini listening to the video).
     */
    async getTranscript(videoId) {
        const providers = [
            ['youtube-transcript', () => this.fetchWithYoutubeTranscript(videoId)],
            ['youtubei.js', () => this.fetchWithInnertube(videoId)],
        ];
        let rateLimited = false;

        for (const [name, fetchLines] of providers) {
            try {
                const lines = await fetchLines();
                if (lines.length > 0) {
                    console.log(`Transcript for ${videoId}: ${lines.length} lines via ${name}`);
                    return this.mergeSegments(lines);
                }
                console.warn(`Transcript via ${name}: empty result`);
            } catch (error) {
                const label = error?.constructor?.name || 'Error';
                if (label.includes('TooManyRequest')) rateLimited = true;
                console.warn(`Transcript via ${name} failed (${label}): ${error.message}`);
            }
        }

        if (rateLimited) {
            throw new AppError('YouTube is rate-limiting us right now. Please try again in a few minutes.', 503, 'YOUTUBE_RATE_LIMITED');
        }
        throw new AppError(
            'Could not get captions for this video. Try a video with subtitles/CC.',
            422,
            'NO_TRANSCRIPT',
        );
    }

    /** Provider 1: youtube-transcript (InnerTube ANDROID player + timedtext) */
    async fetchWithYoutubeTranscript(videoId) {
        const items = await YoutubeTranscript.fetchTranscript(videoId);
        if (!Array.isArray(items) || items.length === 0) return [];

        // This library returns milliseconds for srv3 captions and seconds for
        // classic ones. Caption lines last ~1-10s, so a median duration above
        // 50 can only mean milliseconds.
        const durations = items.map((i) => Number(i.duration) || 0).sort((a, b) => a - b);
        const medianDuration = durations[Math.floor(durations.length / 2)];
        const divisor = medianDuration > 50 ? 1000 : 1;

        return items
            .map((i) => ({ start: (Number(i.offset) || 0) / divisor, text: decodeEntities(i.text) }))
            .filter((i) => i.text);
    }

    /** Provider 2: youtubei.js — the same transcript panel the YouTube website uses */
    async fetchWithInnertube(videoId) {
        const yt = await this.getInnertube();
        const info = await yt.getInfo(videoId);
        const transcriptInfo = await info.getTranscript();
        const segments = transcriptInfo?.transcript?.content?.body?.initial_segments || [];

        return segments
            .filter((seg) => seg && seg.start_ms !== undefined && seg.snippet)
            .map((seg) => ({
                start: (Number(seg.start_ms) || 0) / 1000,
                text: decodeEntities(seg.snippet.toString ? seg.snippet.toString() : seg.snippet.text),
            }))
            .filter((i) => i.text);
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
