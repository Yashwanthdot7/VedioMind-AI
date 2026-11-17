const { createClient } = require('@supabase/supabase-js');

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * It bypasses Row Level Security, so it must only ever run on the server.
 *
 * If Supabase isn't configured, `supabase` is null and the app runs in
 * "guest mode": everything works, but nothing is saved.
 */
const url = process.env.SUPABASE_URL;
// New-style "sb_secret_..." key (preferred) or legacy service_role JWT
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const isPlaceholder = (v) => !v || v.includes('your-project') || v.includes('your_service_role') || v.includes('your_secret_key');

if (serviceKey && serviceKey.startsWith('sb_publishable_')) {
    console.warn('SUPABASE_SECRET_KEY is set to a publishable key. The backend needs the sb_secret_... key.');
}

const supabase = !isPlaceholder(url) && !isPlaceholder(serviceKey)
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;

module.exports = { supabase, isSupabaseEnabled: Boolean(supabase) };
