const { supabase } = require('../config/supabase');
const AppError = require('../lib/AppError');

/**
 * Reads "Authorization: Bearer <supabase access token>" and, if valid,
 * sets req.user = { id, email }. Never blocks the request.
 */
async function optionalAuth(req, _res, next) {
    req.user = null;
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token || !supabase) return next();

    try {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user) {
            req.user = { id: data.user.id, email: data.user.email };
        }
    } catch (err) {
        console.warn('Auth token check failed:', err.message);
    }
    next();
}

/**
 * Use after optionalAuth on routes that need a signed-in user.
 */
function requireAuth(req, _res, next) {
    if (!supabase) {
        return next(new AppError('Accounts are not enabled on this server', 501, 'AUTH_DISABLED'));
    }
    if (!req.user) {
        return next(new AppError('Please sign in to continue', 401, 'UNAUTHENTICATED'));
    }
    next();
}

module.exports = { optionalAuth, requireAuth };
