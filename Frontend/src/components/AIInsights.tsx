import { useState } from 'react';
import { Brain, Lightbulb, CheckCircle2, Copy, Check } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { LearnerLevel } from '../types';
import { LEVEL_INFO } from './learner/LearnerChoice';
import RichText from './RichText';

interface AIInsightsProps {
  summary: string;
  keyTakeaways: string[];
  onSeek?: (seconds: number) => void;
  /** Limit height to the viewport and scroll inside (used when the panel is sticky) */
  scrollable?: boolean;
  /** Level the summary is written for, and a way to switch it */
  level?: LearnerLevel;
  onLevelChange?: (level: LearnerLevel) => void;
  levelBusy?: boolean;
  levelNotice?: string | null;
}

export default function AIInsights({ summary, keyTakeaways, onSeek, scrollable = false, level = 'intermediate', onLevelChange, levelBusy = false, levelNotice }: AIInsightsProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = `${summary}\n\nKey takeaways:\n${keyTakeaways.map((t) => `- ${t}`).join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className={`bg-ink-900/50 border border-ink-800/50 rounded-2xl overflow-hidden backdrop-blur-sm ${scrollable ? 'lg:max-h-[calc(100vh-8rem)] lg:flex lg:flex-col' : ''}`}>
      <div className="p-4 border-b border-ink-800/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-neon-400" />
          <h2 className="text-lg font-semibold text-ink-200">AI Insights</h2>
        </div>
        <button
          onClick={copy}
          className="p-2 rounded-lg bg-ink-800/50 hover:bg-ink-700/50 text-ink-400 hover:text-ink-200 transition-colors"
          title="Copy summary and takeaways"
          aria-label="Copy summary and takeaways"
        >
          {copied ? <Check className="w-4 h-4 text-aqua-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      {onLevelChange && (
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-800/50 px-4 py-2.5 shrink-0">
          <span className="text-xs text-ink-400">Explained for</span>
          <div role="radiogroup" aria-label="Explain the summary for" className="flex rounded-full bg-ink-950/60 p-0.5">
            {LEVEL_INFO.map((l) => (
              <button
                key={l.value}
                role="radio"
                aria-checked={level === l.value}
                disabled={levelBusy}
                onClick={() => onLevelChange(l.value)}
                title={l.hint}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${level === l.value ? 'bg-neon-400 text-white' : 'text-ink-300 hover:text-white'}`}
              >
                {l.label}
              </button>
            ))}
          </div>
          {levelBusy && <Loader2 className="h-4 w-4 animate-spin text-neon-300" aria-label="Rewriting the summary" />}
        </div>
      )}

      <div className={`p-6 space-y-6 ${scrollable ? 'lg:overflow-y-auto custom-scrollbar' : ''} ${levelBusy ? 'opacity-50' : ''} transition-opacity`}>
        {levelNotice && <p className="text-xs text-amber-300">{levelNotice}</p>}
        <div>
          <h3 className="text-sm font-semibold text-neon-400 mb-3">Summary</h3>
          <RichText text={summary} onSeek={onSeek} className="text-ink-300" />
        </div>

        {keyTakeaways.length > 0 && (
          <div className="pt-6 border-t border-ink-800/50">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-plasma-300" />
              <h3 className="text-sm font-semibold text-plasma-300">Key takeaways</h3>
            </div>
            <ul className="space-y-3">
              {keyTakeaways.map((takeaway, index) => (
                <li key={index} className="flex items-start gap-3 group">
                  <CheckCircle2 className="w-5 h-5 text-aqua-400 flex-shrink-0 mt-0.5" />
                  <span className="text-ink-300 leading-relaxed group-hover:text-ink-200 transition-colors">
                    {takeaway}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
