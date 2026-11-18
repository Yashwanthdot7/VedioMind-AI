const rateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const make = (limit, message) => rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Signed-in users are limited per account, guests per IP
    keyGenerator: (req) => req.user?.id || req.ip,
    skip: () => process.env.NODE_ENV === 'test',
    handler: (_req, res) => res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        error: message,
    }),
});

module.exports = {
    // Each video costs one Gemini call (two before caching), so keep this tight
    processLimiter: make(20, 'Too many videos processed. Please wait a few minutes and try again.'),
    // Each lesson = 1 script call + one voice call per scene; keep well inside the free tier
    lessonLimiter: make(8, 'You can create up to 8 video lessons every 15 minutes. Please wait a little.'),
    // A course is an outline call plus 3-5 lessons
    courseLimiter: make(3, 'You can create up to 3 courses every 15 minutes. Please wait a little.'),
    studyLimiter: make(40, 'Too many study tools generated. Please wait a few minutes and try again.'),
    chatLimiter: make(60, 'Too many questions in a short time. Please slow down a little.'),
    generalLimiter: make(300, 'Too many requests. Please try again shortly.'),
};
