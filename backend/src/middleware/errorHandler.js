const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Handle specific error types
    if (err.message.includes('transcript')) {
        return res.status(404).json({
            success: false,
            error: 'No transcript available for this video',
            message: err.message
        });
    }

    if (err.message.includes('YouTube')) {
        return res.status(400).json({
            success: false,
            error: 'Invalid YouTube video',
            message: err.message
        });
    }

    if (err.message.includes('Gemini') || err.message.includes('AI')) {
        return res.status(503).json({
            success: false,
            error: 'AI service temporarily unavailable',
            message: err.message
        });
    }

    // Default error
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
};

module.exports = errorHandler;