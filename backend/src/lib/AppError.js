/**
 * Error with an HTTP status and a stable machine-readable code,
 * so the error handler doesn't have to guess from message text.
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

module.exports = AppError;
