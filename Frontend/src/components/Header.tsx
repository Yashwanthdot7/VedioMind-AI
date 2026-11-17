import { FormEvent, useEffect, useRef, useState } from 'react';
import { Sparkles, Youtube, Languages, Library, LogIn, LogOut, ChevronDown, Clapperboard, BarChart3 } from 'lucide-react';
import { ProcessingStatus } from '../types';
import { LANGUAGES } from '../constants/languages';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onSummarize: (url: string) => void;
  status: ProcessingStatus;
  language: string;
  onLanguageChange: (code: string) => void;
  onOpenLibrary: () => void;
  onOpenLessons: () => void;
  onOpenAnalytics: () => void;
  onOpenAuth: () => void;
  onGoHome: () => void;
}

function UserMenu({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!user) return null;
  const name = (user.user_metadata?.full_name as string) || user.email || 'You';
  const avatar = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-slate-800/60 transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {avatar ? (
          <img src={avatar} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2">
          <div className="px-4 py-2 border-b border-slate-800 mb-1">
            <p className="text-sm text-slate-200 truncate">{name}</p>
            {user.email && name !== user.email && <p className="text-xs text-slate-500 truncate">{user.email}</p>}
          </div>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onOpenLibrary(); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            <Library className="w-4 h-4" /> My Library
          </button>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); signOut(); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header({
  onSummarize, status, language, onLanguageChange, onOpenLibrary, onOpenLessons, onOpenAnalytics, onOpenAuth, onGoHome,
}: HeaderProps) {
  const { enabled: authEnabled, user, loading } = useAuth();
  const [url, setUrl] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim()) onSummarize(url.trim());
  };

  const isLoading = status === ProcessingStatus.LOADING;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 py-3 md:h-20 md:py-0">
          <button onClick={onGoHome} className="flex items-center gap-3 shrink-0" aria-label="VideoMind AI home">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              VideoMind AI
            </span>
          </button>

          <div className="ml-auto flex items-center gap-2 md:order-3">
            <button
              onClick={onOpenLessons}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
              title="Create a video lesson"
            >
              <Clapperboard className="w-4 h-4" /> <span className="hidden lg:inline">Create video</span>
            </button>
            <button
              onClick={onOpenAnalytics}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
              title="Your quiz progress"
            >
              <BarChart3 className="w-4 h-4" /> <span className="hidden lg:inline">Analytics</span>
            </button>
            {authEnabled && !loading && (
              user ? (
                <>
                  <button
                    onClick={onOpenLibrary}
                    className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
                  >
                    <Library className="w-4 h-4" /> Library
                  </button>
                  <UserMenu onOpenLibrary={onOpenLibrary} />
                </>
              ) : (
                <button
                  onClick={onOpenAuth}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-200 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 rounded-lg transition-colors"
                >
                  <LogIn className="w-4 h-4" /> Sign in
                </button>
              )
            )}
          </div>

          <form onSubmit={handleSubmit} className="w-full md:flex-1 md:max-w-3xl md:mx-6 md:order-2 flex gap-2">
            <div className="relative flex-1 flex items-center">
              <div className="absolute left-3 pointer-events-none">
                <Youtube className="w-5 h-5 text-slate-400" />
              </div>
              <input
                type="text"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube URL here..."
                disabled={isLoading}
                aria-label="YouTube URL"
                className="w-full pl-11 pr-28 py-2.5 md:py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={isLoading || !url.trim()}
                className="absolute right-1.5 px-4 md:px-5 py-1.5 md:py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/20"
              >
                {isLoading ? 'Working…' : 'Summarize'}
              </button>
            </div>
            <label className="relative flex items-center" title="Output language">
              <Languages className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value)}
                disabled={isLoading}
                aria-label="Output language"
                className="appearance-none pl-9 pr-3 py-2.5 md:py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-slate-900">
                    {l.native}
                  </option>
                ))}
              </select>
            </label>
          </form>
        </div>
      </div>
    </header>
  );
}
