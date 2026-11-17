const rateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const make = (limit, message) => rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Signed-in users are limited per account, guests per IP
    keyGenerator: (req) => req.user?.id || req.ip,
    handler: (_req, res) => res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        error: message,
    }),
});

module.exports = {
    // Each video costs one Gemini call (two before caching), so keep this tight
    processLimiter: make(20, 'Too many videos processed. Please wait a few minutes and try again.'),
    chatLimiter: make(60, 'Too many questions in a short time. Please slow down a little.'),
    generalLimiter: make(300, 'Too many requests. Please try again shortly.'),
};
