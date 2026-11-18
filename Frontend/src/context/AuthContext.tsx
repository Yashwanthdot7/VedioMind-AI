import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { Learner } from '../types';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isAuthEnabled } from '../lib/supabase';

interface AuthContextValue {
  enabled: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string, fullName: string, learner?: Learner) => Promise<{ needsConfirmation: boolean }>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function requireClient() {
  if (!supabase) throw new Error('Sign-in is not configured for this app.');
  return supabase;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isAuthEnabled);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    enabled: isAuthEnabled,
    loading,
    session,
    user: session?.user ?? null,

    async signInWithGoogle() {
      const { error } = await requireClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    },

    async signInWithPassword(email, password) {
      const { error } = await requireClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
    },

    async signUpWithPassword(email, password, fullName, learner) {
      const { data, error } = await requireClient().auth.signUp({
        email,
        password,
        // role and level go into the profile at sign-up (database trigger, migration 005)
        options: { data: { full_name: fullName, ...(learner && { role: learner.role, level: learner.level }) }, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      return { needsConfirmation: !data.session };
    },

    async sendPasswordReset(email) {
      const { error } = await requireClient().auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
    },

    async signOut() {
      if (supabase) await supabase.auth.signOut();
    },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
