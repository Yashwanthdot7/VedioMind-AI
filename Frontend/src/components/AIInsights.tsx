import { useState } from 'react';
import { Brain, Lightbulb, CheckCircle2, Copy, Check } from 'lucide-react';
import RichText from './RichText';

interface AIInsightsProps {
  summary: string;
  keyTakeaways: string[];
  onSeek?: (seconds: number) => void;
}

export default function AIInsights({ summary, keyTakeaways, onSeek }: AIInsightsProps) {
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
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden backdrop-blur-sm">
      <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-slate-200">AI Insights</h2>
        </div>
        <button
          onClick={copy}
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
          title="Copy summary and takeaways"
          aria-label="Copy summary and takeaways"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-3">Summary</h3>
          <RichText text={summary} onSeek={onSeek} className="text-slate-300" />
        </div>

        {keyTakeaways.length > 0 && (
          <div className="pt-6 border-t border-slate-800/50">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Key Takeaways</h3>
            </div>
            <ul className="space-y-3">
              {keyTakeaways.map((takeaway, index) => (
                <li key={index} className="flex items-start gap-3 group">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300 leading-relaxed group-hover:text-slate-200 transition-colors">
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
