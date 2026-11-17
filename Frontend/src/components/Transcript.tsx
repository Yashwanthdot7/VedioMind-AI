import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Clock, Search, X, Copy, Check } from 'lucide-react';
import { TranscriptSegment } from '../types';

interface TranscriptProps {
  segments: TranscriptSegment[];
  currentTime?: number;
  onSeek?: (seconds: number) => void;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-amber-400/30 text-amber-200 rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function Transcript({ segments, currentTime = 0, onSeek }: TranscriptProps) {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const trimmed = query.trim();

  const visible = useMemo(() => {
    const indexed = segments.map((segment, index) => ({ segment, index }));
    if (!trimmed) return indexed;
    const q = trimmed.toLowerCase();
    return indexed.filter(({ segment }) => segment.text.toLowerCase().includes(q));
  }, [segments, trimmed]);

  // Index of the segment currently playing
  const activeIndex = useMemo(() => {
    let active = -1;
    for (let i = 0; i < segments.length; i += 1) {
      if (segments[i].seconds <= currentTime) active = i;
      else break;
    }
    return active;
  }, [segments, currentTime]);

  // Keep the playing segment in view (inside the panel only, never scroll the page)
  useEffect(() => {
    if (trimmed || activeIndex < 0) return;
    const container = containerRef.current;
    const item = itemRefs.current[activeIndex];
    if (!container || !item) return;
    const top = item.offsetTop; // container is position:relative, so this is relative to it
    const outOfView = top < container.scrollTop || top + item.offsetHeight > container.scrollTop + container.clientHeight;
    if (outOfView) container.scrollTo({ top: Math.max(0, top - 24), behavior: 'smooth' });
  }, [activeIndex, trimmed]);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(segments.map((s) => `[${s.timestamp}] ${s.text}`).join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden backdrop-blur-sm">
      <div className="p-4 border-b border-slate-800/50 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 mr-auto">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-slate-200">Smart Transcript</h2>
        </div>
        <div className="relative flex items-center w-full sm:w-64">
          <Search className="absolute left-3 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcript…"
            aria-label="Search transcript"
            className="w-full pl-9 pr-8 py-2 bg-slate-950/50 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 p-1 text-slate-500 hover:text-slate-300" aria-label="Clear search">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={copyAll}
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
          title="Copy full transcript"
          aria-label="Copy full transcript"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      {trimmed && (
        <div className="px-6 pt-3 text-xs text-slate-500">
          {visible.length} {visible.length === 1 ? 'match' : 'matches'} for “{trimmed}”
        </div>
      )}

      <div ref={containerRef} className="relative p-4 sm:p-6 max-h-96 overflow-y-auto custom-scrollbar">
        {visible.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No part of the transcript matches your search.</p>
        ) : (
          <div className="space-y-2">
            {visible.map(({ segment, index }) => {
              const isActive = !trimmed && index === activeIndex;
              return (
                <div
                  key={index}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  className={`group flex gap-3 sm:gap-4 p-3 rounded-lg transition-colors ${
                    isActive ? 'bg-indigo-500/10 border border-indigo-500/30' : 'border border-transparent hover:bg-slate-800/30'
                  }`}
                >
                  <button
                    onClick={() => onSeek?.(segment.seconds)}
                    className="flex-shrink-0 self-start flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/50 hover:bg-indigo-600/20 border border-slate-700/50 hover:border-indigo-500/50 rounded-lg transition-all"
                    title={`Jump to ${segment.timestamp}`}
                  >
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-sm font-mono text-indigo-400">{segment.timestamp}</span>
                  </button>
                  <p className={`leading-relaxed ${isActive ? 'text-slate-100' : 'text-slate-300'}`}>
                    <Highlighted text={segment.text} query={trimmed} />
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
