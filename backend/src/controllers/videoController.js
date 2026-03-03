const youtubeService = require('../services/youtubeService');
const geminiService = require('../services/geminiService');

class VideoController {
    /**
     * Process YouTube video
     */
    async processVideo(req, res, next) {
        try {
            const { url } = req.body;

            if (!url) {
                return res.status(400).json({ error: 'URL is required' });
            }

            // Extract video ID
            const videoId = youtubeService.extractVideoId(url);
            console.log(`Processing video: ${videoId}`);

            // Get video info
            const videoInfo = await youtubeService.getVideoInfo(videoId);

            // Get transcript
            const transcript = await youtubeService.getTranscript(videoId);
            const fullTranscript = youtubeService.getFullTranscriptText(transcript);

            // Generate summary using Gemini
            const summary = await geminiService.generateSummary(videoInfo.title, fullTranscript);

            // Extract key takeaways
            const keyTakeaways = await geminiService.extractKeyTakeaways(fullTranscript);

            const videoData = {
                videoId,
                title: videoInfo.title,
                transcript,
                summary,
                keyTakeaways: keyTakeaways.slice(0, 7), // Limit to 7 takeaways
                metadata: {
                    duration: videoInfo.duration,
                    author: videoInfo.author,
                    thumbnail: videoInfo.thumbnail
                }
            };

            res.json({
                success: true,
                data: videoData,
                message: 'Video processed successfully'
            });

        } catch (error) {
            console.error('Video processing error:', error);
            next(error);
        }
    }

    /**
     * Get video metadata only
     */
    async getVideoInfo(req, res, next) {
        try {
            const { url } = req.body;

            if (!url) {
                return res.status(400).json({ error: 'URL is required' });
            }

            const videoId = youtubeService.extractVideoId(url);
            const videoInfo = await youtubeService.getVideoInfo(videoId);

            res.json({
                success: true,
                data: videoInfo
            });

        } catch (error) {
            console.error('Error fetching video info:', error);
            next(error);
        }
    }
}

module.exports = new VideoController();