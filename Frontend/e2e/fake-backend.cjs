/**
 * The real VideoMind API with every outside service faked, for end-to-end tests:
 * YouTube, Gemini (analysis, chat, scripts, outlines, quizzes, voice), pictures and Supabase.
 * No network and no API keys. Run: node e2e/fake-backend.cjs   (port 3101)
 */
const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'e2e-fake';
process.env.CORS_ORIGINS = 'http://localhost:5199';
process.env.LESSON_STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-e2e-'));

const backend = path.join(__dirname, '../../backend');
require(path.join(backend, 'test/helpers/fakeSupabase')).install({
  'e2e-teacher': { id: '33333333-3333-4333-8333-333333333333' },
});
const src = (p) => require(path.join(backend, 'src', p));

const yt = src('services/youtubeService');
const gemini = src('services/geminiService');
const tts = src('services/ttsService');
const images = src('services/imageService');

yt.getVideoInfo = async (videoId) => ({ videoId, title: 'How Photosynthesis Works', duration: 600, author: 'Science Channel', thumbnail: null });
yt.getTranscript = async () => Array.from({ length: 24 }, (_, i) => ({
  seconds: i * 25, timestamp: yt.formatTimestamp(i * 25),
  text: i === 4 ? 'Chlorophyll absorbs red and blue light and reflects green light.' : `Part ${i}: plants turn sunlight, water and carbon dioxide into glucose and oxygen.`,
}));
gemini.analyzeVideo = async () => ({
  summary: 'This video explains **photosynthesis**.\n\n- **Chlorophyll** captures light [1:40]\n- Water and CO₂ become glucose and oxygen',
  keyTakeaways: ['Plants make glucose from sunlight.', 'Chlorophyll absorbs red and blue light.'],
});
gemini.chat = async () => 'Chlorophyll is explained at [1:40]. It absorbs red and blue light and reflects green.';

const scene = (layout, heading, extra = {}) => ({
  layout, icon: '🌋', heading, narration: `${heading}. A short narration for this scene.`, imagePrompt: 'volcano',
  bullets: ['First point', 'Second point'], highlight: '', leftTitle: '', left: [], rightTitle: '', right: [], ...extra,
});
const SCRIPT = { title: 'How Volcanoes Work', scenes: [scene('title', 'Volcanoes'), scene('fact', 'How hot is lava?', { highlight: '1200°C' }), scene('summary', 'Recap')] };
const OUTLINE = {
  title: 'Volcanoes: from magma to eruption',
  modules: ['Inside the Earth', 'Magma rises', 'Eruptions'].map((title) => ({ title, goal: `Understand ${title.toLowerCase()}.`, keyPoints: ['one', 'two'] })),
};
const QUIZ = {
  questions: Array.from({ length: 10 }, (_, i) => ({
    question: `Question ${i + 1}: what is magma called on the surface?`, options: ['Lava', 'Ash', 'Steam', 'Ice'], answerIndex: 0,
    explanation: 'Magma that erupts is called lava.', difficulty: ['easy', 'medium', 'hard'][i % 3], scene: 1,
  })),
};
gemini.withModel = async (_options, fn) => fn({
  generateContent: async (prompt) => {
    const p = String(prompt);
    const body = p.startsWith('You are planning') ? OUTLINE : p.startsWith('Write a ') ? QUIZ : SCRIPT;
    return { response: { text: () => JSON.stringify(body), usageMetadata: { promptTokenCount: 100 } } };
  },
});

const pcm = Buffer.alloc(24000 * 2); // 1 s of silence per scene
tts.fetch = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm.toString('base64') } }] } }] }) });
images.generate = async () => { throw Object.assign(new Error('pictures off in e2e'), { code: 'IMAGE_FAILED' }); };

const port = Number(process.env.E2E_API_PORT || 3101);
src('app').listen(port, () => console.log(`fake backend on ${port}`));
