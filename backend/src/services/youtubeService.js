const ytdl = require('@distube/ytdl-core');
const { YoutubeTranscript } = require('youtube-transcript');

class YouTubeService {
    /**
     * Extract video ID from YouTube URL
     */
    extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=)([^&]+)/,
            /(?:youtu\.be\/)([^?]+)/,
            /(?:youtube\.com\/embed\/)([^/]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        throw new Error('Invalid YouTube URL');
    }

    /**
     * Get video metadata
     */
    async getVideoInfo(videoId) {
        try {
            const info = await ytdl.getBasicInfo(videoId);
            return {
                videoId,
                title: info.videoDetails.title,
                description: info.videoDetails.description,
                duration: parseInt(info.videoDetails.lengthSeconds),
                author: info.videoDetails.author.name,
                thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url
            };
        } catch (error) {
            console.error('Error fetching video info:', error);
            throw new Error('Failed to fetch video information');
        }
    }

    /**
     * Get video transcript
     */
    async getTranscript(videoId) {
        try {
            const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

            return transcriptItems.map(item => ({
                text: item.text,
                timestamp: this.formatTimestamp(item.offset / 1000),
                seconds: Math.floor(item.offset / 1000),
                duration: item.duration
            }));
        } catch (error) {
            console.error('Error fetching transcript:', error);
            throw new Error('Failed to fetch video transcript. Make sure the video has captions available.');
        }
    }

    /**
     * Format seconds to timestamp (MM:SS)
     */
    formatTimestamp(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Get full transcript text
     */
    getFullTranscriptText(transcript) {
        return transcript.map(item => item.text).join(' ');
    }
}

module.exports = new YouTubeService();