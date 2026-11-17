/**
 * Diagnose transcript fetching for one video.
 * Usage: npm run check:video -- "https://www.youtube.com/watch?v=VIDEO_ID"
 *        npm run check:video -- "<url>" --ai     (also test Gemini transcription)
 */
require('dotenv').config();
const youtubeService = require('../src/services/youtubeService');
const { extractVideoId } = require('../src/utils/validators');

async function attempt(name, fn) {
    const started = Date.now();
    try {
        const lines = await fn();
        const ms = Date.now() - started;
        if (lines.length) {
            console.log(`  ✅ ${name}: ${lines.length} lines (${ms} ms)`);
            console.log(`     first: [${Math.floor(lines[0].start)}s] ${lines[0].text.slice(0, 80)}`);
        } else {
            console.log(`  ⚠️  ${name}: returned nothing (${ms} ms)`);
        }
    } catch (error) {
        console.log(`  ❌ ${name}: ${error?.constructor?.name || 'Error'} — ${error.message}`);
    }
}

(async () => {
    const url = process.argv[2];
    if (!url) {
        console.log('Usage: npm run check:video -- "<YouTube URL>" [--ai]');
        process.exit(1);
    }
    const videoId = extractVideoId(url);
    console.log(`\nVideo ${videoId}`);

    const info = await youtubeService.getVideoInfo(videoId).catch((e) => ({ error: e.message }));
    console.log(info.error ? `  ❌ metadata: ${info.error}` : `  ✅ metadata: "${info.title}" (${info.duration ?? '?'}s)`);

    console.log('\nTranscript sources:');
    await attempt('youtube-transcript', () => youtubeService.fetchWithYoutubeTranscript(videoId));
    await attempt('youtubei.js       ', () => youtubeService.fetchWithInnertube(videoId));

    if (process.argv.includes('--ai')) {
        const gemini = require('../src/services/geminiService');
        await attempt('Gemini (AI)       ', () => gemini.transcribeYouTube(videoId));
        if (gemini.activeModel) console.log(`     model: ${gemini.activeModel}`);
    } else {
        console.log('  (add --ai to also test Gemini transcription; it uses some of your Gemini quota)');
    }
    console.log('');
    process.exit(0);
})();
