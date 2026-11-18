const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const videoRoutes = require('./routes/videoRoutes');
const chatRoutes = require('./routes/chatRoutes');
const libraryRoutes = require('./routes/libraryRoutes');
const studyRoutes = require('./routes/studyRoutes');
const lessonRoutes = require('./routes/lessonRoutes');
const attemptRoutes = require('./routes/attemptRoutes');
const errorHandler = require('./middleware/errorHandler');
const { optionalAuth } = require('./middleware/auth');
const { generalLimiter } = require('./middleware/rateLimit');
const { isSupabaseEnabled } = require('./config/supabase');
const { LANGUAGES } = require('./config/languages');
const AppError = require('./lib/AppError');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

// Behind Render/Railway/Vercel proxies, so rate limiting sees the real client IP
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors({
    origin(origin, callback) {
        // Allow same-origin / curl / server-to-server requests (no Origin header)
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new AppError(`Origin ${origin} is not allowed`, 403, 'CORS_BLOCKED'));
    },
    credentials: true,
}));
// Chat may fall back to sending the transcript, so allow a reasonable body size
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        ai: Boolean(process.env.GEMINI_API_KEY),
        database: isSupabaseEnabled,
    });
});

app.get('/api/languages', (_req, res) => {
    res.json({ success: true, data: LANGUAGES });
});

app.use('/api', optionalAuth, generalLimiter);
app.use('/api/video', videoRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/quiz-attempts', attemptRoutes);

app.use('/api', (_req, _res, next) => next(new AppError('Endpoint not found', 404, 'NOT_FOUND')));

app.use(errorHandler);

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`VideoMind AI backend running on port ${PORT}`);
        console.log(`  Gemini API key: ${process.env.GEMINI_API_KEY ? 'configured' : 'MISSING'}`);
        console.log(`  Supabase:       ${isSupabaseEnabled ? 'connected' : 'disabled (guest mode, nothing is saved)'}`);
        console.log(`  CORS origins:   ${allowedOrigins.join(', ')}`);
    });
}

module.exports = app;
