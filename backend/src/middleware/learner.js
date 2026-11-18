const { supabase } = require('../config/supabase');
const { normaliseLearner, parseLearnerHeader } = require('../config/learner');

/**
 * Sets req.learner = { role, level } for every API request.
 * Signed in: from the user's profile (cached for a minute). Guest: from the X-Learner
 * header the app sends ("student:beginner"), which the guest picks in settings.
 */
const TTL_MS = 60 * 1000;
const cache = new Map(); // userId -> { value, at }

async function loadProfile(userId) {
    const hit = cache.get(userId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
    const { data, error } = await supabase.from('profiles').select('role, level, onboarded').eq('id', userId).maybeSingle();
    if (error) throw error;
    // Older accounts store 'kid'/'other' roles; they get the student defaults
    const value = data
        ? { ...normaliseLearner({ role: data.role, level: data.level }), onboarded: Boolean(data.onboarded) }
        : null;
    cache.set(userId, { value, at: Date.now() });
    return value;
}

function forget(userId) {
    cache.delete(userId);
}

async function attachLearner(req, _res, next) {
    req.learner = parseLearnerHeader(req.headers['x-learner']);
    if (req.user && supabase) {
        try {
            const profile = await loadProfile(req.user.id);
            if (profile?.onboarded) req.learner = { role: profile.role, level: profile.level };
        } catch (error) {
            // Before migration 005 the columns don't exist; keep the header's choice
            if (!/column .* does not exist|could not find/i.test(error.message || '')) {
                console.warn('Loading the learner profile failed:', error.message);
            }
        }
    }
    next();
}

module.exports = { attachLearner, loadProfile, forget };
