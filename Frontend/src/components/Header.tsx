import { useState } from 'react';
import { Sparkles, Youtube } from 'lucide-react';
import { ProcessingStatus } from '../types';

interface HeaderProps {
  onSummarize: (url: string) => void;
  status: ProcessingStatus;
}

export default function Header({ onSummarize, status }: HeaderProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSummarize(url);
    }
  };

  const isLoading = status === ProcessingStatus.LOADING;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              VideoMind AI
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 max-w-2xl mx-4 md:mx-8">
            <div className="relative flex items-center">
              <div className="absolute left-3 pointer-events-none">
                <Youtube className="w-5 h-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube URL here..."
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-2.5 md:py-3 bg-slate-900/50 border border-slate-700/50 rounded-lg md:rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={isLoading || !url.trim()}
                className="absolute right-2 px-4 md:px-6 py-1.5 md:py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg md:rounded-lg text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30"
              >
                {isLoading ? 'Processing...' : 'Summarize'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </header>
  );
}