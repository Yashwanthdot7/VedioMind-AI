const { createClient } = require('@supabase/supabase-js');

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * It bypasses Row Level Security, so it must only ever run on the server.
 *
 * If Supabase isn't configured, `supabase` is null and the app runs in
 * "guest mode": everything works, but nothing is saved.
 */
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isPlaceholder = (v) => !v || v.includes('your-project') || v.includes('your_service_role');

const supabase = !isPlaceholder(url) && !isPlaceholder(serviceKey)
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;

module.exports = { supabase, isSupabaseEnabled: Boolean(supabase) };
