import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const configured = Boolean(url && anonKey && !url.includes('your-project') && !anonKey.includes('your_anon_key'));

/**
 * Browser Supabase client (public anon key — safe to ship).
 * null when Supabase isn't configured: the app then runs in guest mode.
 */
export const supabase: SupabaseClient | null = configured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const isAuthEnabled = configured;
