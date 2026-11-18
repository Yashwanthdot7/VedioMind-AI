import { FormEvent, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/errors';

type Mode = 'signin' | 'signup' | 'reset';

// Google sign-in needs setup in Google Cloud + Supabase, so it's opt-in
const GOOGLE_ENABLED = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 9.2-4.9 9.2-7.4 0-.5 0-.9-.1-1.3H12z" />
    </svg>
  );
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const { signInWithGoogle, signInWithPassword, signUpWithPassword, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') {
        await signInWithPassword(email, password);
        onClose();
      } else if (mode === 'signup') {
        const { needsConfirmation } = await signUpWithPassword(email, password, fullName);
        if (needsConfirmation) {
          setNotice('Check your email to confirm your account, then sign in.');
          setMode('signin');
        } else {
          onClose();
        }
      } else {
        await sendPasswordReset(email);
        setNotice('If that email has an account, a reset link is on its way.');
      }
    } catch (err) {
      setError(errorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle(); // redirects away
    } catch (err) {
      setError(errorMessage(err, 'Google sign-in failed.'));
    }
  };

  const title = mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/80 backdrop-blur-md px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 22 }}
            className="relative w-full max-w-md bg-ink-900 border border-ink-800 rounded-2xl p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-ink-800 text-ink-400"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 id="auth-title" className="text-2xl font-bold text-ink-100 mb-1">{title}</h2>
            <p className="text-sm text-ink-400 mb-6">
              Save your videos, summaries and chats across devices.
            </p>

            {mode !== 'reset' && GOOGLE_ENABLED && (
              <>
                <button
                  onClick={handleGoogle}
                  className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-ink-100 text-ink-900 font-medium rounded-xl transition-colors"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
                <div className="flex items-center gap-3 my-5 text-xs text-ink-500">
                  <div className="flex-1 h-px bg-ink-800" />
                  or with email
                  <div className="flex-1 h-px bg-ink-800" />
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <label className="flex items-center gap-3 px-4 py-3 bg-ink-950/60 border border-ink-800 rounded-xl focus-within:ring-2 focus-within:ring-neon-500">
                  <UserIcon className="w-4 h-4 text-ink-500" />
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name"
                    autoComplete="name"
                    className="flex-1 bg-transparent text-ink-200 placeholder-ink-500 focus:outline-none"
                  />
                </label>
              )}
              <label className="flex items-center gap-3 px-4 py-3 bg-ink-950/60 border border-ink-800 rounded-xl focus-within:ring-2 focus-within:ring-neon-500">
                <Mail className="w-4 h-4 text-ink-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  className="flex-1 bg-transparent text-ink-200 placeholder-ink-500 focus:outline-none"
                />
              </label>
              {mode !== 'reset' && (
                <label className="flex items-center gap-3 px-4 py-3 bg-ink-950/60 border border-ink-800 rounded-xl focus-within:ring-2 focus-within:ring-neon-500">
                  <Lock className="w-4 h-4 text-ink-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (min 6 characters)"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    className="flex-1 bg-transparent text-ink-200 placeholder-ink-500 focus:outline-none"
                  />
                </label>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}
              {notice && <p className="text-sm text-aqua-400">{notice}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-3 bg-neon-400 hover:bg-neon-500 disabled:bg-ink-700 text-white font-medium rounded-xl transition-colors"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
              </button>
            </form>

            <div className="mt-5 text-sm text-ink-400 text-center space-y-2">
              {mode === 'signin' && (
                <>
                  <p>
                    New here?{' '}
                    <button onClick={() => switchMode('signup')} className="text-neon-400 hover:underline">Create an account</button>
                  </p>
                  <button onClick={() => switchMode('reset')} className="text-ink-500 hover:text-ink-300">Forgot password?</button>
                </>
              )}
              {mode !== 'signin' && (
                <p>
                  Already have an account?{' '}
                  <button onClick={() => switchMode('signin')} className="text-neon-400 hover:underline">Sign in</button>
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
