const AppError = require('../lib/AppError');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    // Malformed JSON body
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, code: 'BAD_JSON', error: 'Invalid JSON body' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, code: 'TOO_LARGE', error: 'Request is too large' });
    }

    if (err instanceof AppError) {
        if (err.statusCode >= 500) console.error(`[${err.code}]`, err.message);
        return res.status(err.statusCode).json({
            success: false,
            code: err.code,
            error: err.message,
        });
    }

    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        error: 'Something went wrong on our side. Please try again.',
        ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    });
};

module.exports = errorHandler;
