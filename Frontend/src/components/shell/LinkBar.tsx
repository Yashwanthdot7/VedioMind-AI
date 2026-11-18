import { FormEvent, useState } from 'react';
import { Youtube, Languages } from 'lucide-react';
import { LANGUAGES } from '../../constants/languages';

interface LinkBarProps {
  busy: boolean;
  language: string;
  onLanguageChange: (code: string) => void;
  onSummarize: (url: string) => void;
}

/** Slim top bar on inner pages: paste another link without going home */
export default function LinkBar({ busy, language, onLanguageChange, onSummarize }: LinkBarProps) {
  const [url, setUrl] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim()) onSummarize(url.trim());
  };

  return (
    <div role="search" className="border-b border-white/[0.07] bg-ink-950">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
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
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-ink-900 border border-ink-800 text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-neon-400/70 disabled:opacity-50"
            />
          </label>
          <label className="relative hidden sm:flex items-center" title="Output language">
            <span className="sr-only">Output language</span>
            <Languages className="absolute left-2.5 w-4 h-4 text-ink-500 pointer-events-none" />
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              disabled={busy}
              className="appearance-none pl-8 pr-3 py-2 rounded-lg bg-ink-900 border border-ink-800 text-sm text-ink-200 focus:outline-none focus:border-neon-400/70"
            >
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="px-4 py-2 rounded-lg bg-neon-400 hover:bg-neon-500 text-white text-sm font-semibold disabled:bg-ink-800 disabled:text-ink-500 transition-colors"
          >
            {busy ? 'Working…' : 'Summarize'}
          </button>
        </form>
      </div>
    </div>
  );
}
