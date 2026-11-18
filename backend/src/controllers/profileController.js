const { supabase } = require('../config/supabase');
const AppError = require('../lib/AppError');
const { ROLES, LEVELS, DEFAULT_LEARNER } = require('../config/learner');
const { loadProfile, forget } = require('../middleware/learner');

const migrationHint = (error) => (/column .* does not exist|could not find/i.test(error?.message || '')
    ? new AppError('Learning profiles aren\'t set up yet: run supabase/migrations/005_learner_profiles.sql in the Supabase SQL Editor.', 503, 'MIGRATION_NEEDED')
    : error);

/** GET /api/profile — the signed-in user's learning profile */
async function get(req, res, next) {
    try {
        const profile = await loadProfile(req.user.id);
        res.json({ success: true, data: profile || { ...DEFAULT_LEARNER, onboarded: false } });
    } catch (error) {
        next(migrationHint(error));
    }
}

/** PUT /api/profile  { role: student|teacher, level: beginner|intermediate|advanced } */
async function update(req, res, next) {
    try {
        const role = req.body?.role;
        const level = req.body?.level ?? 'intermediate';
        if (!ROLES.includes(role)) throw new AppError('Choose student or teacher.', 400, 'INVALID_ROLE');
        if (!LEVELS.includes(level)) throw new AppError('Choose beginner, intermediate or advanced.', 400, 'INVALID_LEVEL');
        const { error } = await supabase.from('profiles').upsert(
            { id: req.user.id, role, level, onboarded: true },
            { onConflict: 'id' },
        );
        if (error) throw error;
        forget(req.user.id);
        res.json({ success: true, data: { role, level, onboarded: true } });
    } catch (error) {
        next(migrationHint(error));
    }
}

module.exports = { get, update };
