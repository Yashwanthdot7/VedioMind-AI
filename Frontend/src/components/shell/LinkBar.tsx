import { FormEvent, useState } from 'react';
import { Youtube, Languages, LogIn } from 'lucide-react';
import { LANGUAGES } from '../../constants/languages';
import { useAuth } from '../../context/AuthContext';
import { LampMark } from './Sidebar';

interface LinkBarProps {
  busy: boolean;
  language: string;
  onLanguageChange: (code: string) => void;
  onSummarize: (url: string) => void;
  onGoHome: () => void;
  onOpenAuth: () => void;
}

/** Slim top bar on inner pages: paste another link without going home */
export default function LinkBar({ busy, language, onLanguageChange, onSummarize, onGoHome, onOpenAuth }: LinkBarProps) {
  const { enabled: authEnabled, user, loading } = useAuth();
  const [url, setUrl] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim()) onSummarize(url.trim());
  };

  return (
    <header className="sticky top-0 z-30 border-b border-ink-800/70 bg-ink-950/90 backdrop-blur">
      <div className="flex items-center gap-3 px-4 lg:px-10 py-3">
        <button onClick={onGoHome} className="lg:hidden text-turmeric-400 shrink-0" aria-label="VideoMind home">
          <LampMark className="w-7 h-7" />
        </button>
        <form onSubmit={submit} className="flex flex-1 items-center gap-2 max-w-3xl">
          <label className="relative flex-1 flex items-center">
            <span className="sr-only">YouTube link</span>
            <Youtube className="absolute left-3 w-4 h-4 text-ink-500 pointer-events-none" />
            <input
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste another YouTube link"
              disabled={busy}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-ink-900 border border-ink-800 text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-turmeric-400/70 disabled:opacity-50"
            />
          </label>
          <label className="relative hidden sm:flex items-center" title="Output language">
            <span className="sr-only">Output language</span>
            <Languages className="absolute left-2.5 w-4 h-4 text-ink-500 pointer-events-none" />
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              disabled={busy}
              className="appearance-none pl-8 pr-3 py-2 rounded-lg bg-ink-900 border border-ink-800 text-sm text-ink-200 focus:outline-none focus:border-turmeric-400/70"
            >
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="px-4 py-2 rounded-lg bg-turmeric-400 hover:bg-turmeric-300 text-ink-950 text-sm font-semibold disabled:bg-ink-800 disabled:text-ink-500 transition-colors"
          >
            {busy ? 'Working…' : 'Summarize'}
          </button>
        </form>
        {authEnabled && !loading && !user && (
          <button onClick={onOpenAuth} className="lg:hidden p-2 rounded-lg text-ink-300 hover:text-ink-100" aria-label="Sign in">
            <LogIn className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  );
}
