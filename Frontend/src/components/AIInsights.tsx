import { Brain, Lightbulb, CheckCircle2 } from 'lucide-react';

interface AIInsightsProps {
  summary: string;
  keyTakeaways: string[];
}

function MarkdownText({ text }: { text: string }) {
  const formatText = (input: string) => {
    const parts = [];
    let currentIndex = 0;
    const boldPattern = /\*\*(.*?)\*\*/g;
    const italicPattern = /\*(.*?)\*/g;

    let match;
    const allMatches: Array<{ start: number; end: number; type: 'bold' | 'italic'; content: string }> = [];

    while ((match = boldPattern.exec(input)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'bold',
        content: match[1],
      });
    }

    boldPattern.lastIndex = 0;

    while ((match = italicPattern.exec(input)) !== null) {
      const isBold = allMatches.some(
        (m) => m.type === 'bold' && match.index >= m.start && match.index < m.end
      );
      if (!isBold) {
        allMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          type: 'italic',
          content: match[1],
        });
      }
    }

    allMatches.sort((a, b) => a.start - b.start);

    allMatches.forEach((match) => {
      if (currentIndex < match.start) {
        parts.push(input.substring(currentIndex, match.start));
      }

      if (match.type === 'bold') {
        parts.push(
          <strong key={match.start} className="font-bold text-indigo-400">
            {match.content}
          </strong>
        );
      } else {
        parts.push(
          <em key={match.start} className="italic text-slate-300">
            {match.content}
          </em>
        );
      }

      currentIndex = match.end;
    });

    if (currentIndex < input.length) {
      parts.push(input.substring(currentIndex));
    }

    return parts.length > 0 ? parts : input;
  };

  const paragraphs = text.split('\n\n');

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, index) => {
        if (paragraph.trim().startsWith('-')) {
          const items = paragraph.split('\n').filter((line) => line.trim());
          return (
            <ul key={index} className="space-y-2 ml-4">
              {items.map((item, i) => (
                <li key={i} className="text-slate-300 leading-relaxed flex items-start gap-2">
                  <span className="text-indigo-400 mt-1.5">â€¢</span>
                  <span>{formatText(item.replace(/^-\s*/, ''))}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="text-slate-300 leading-relaxed">
            {formatText(paragraph)}
          </p>
        );
      })}
    </div>
  );
}

export default function AIInsights({ summary, keyTakeaways }: AIInsightsProps) {
  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden backdrop-blur-sm">
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-slate-200">AI Insights</h2>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-3">
            Summary
          </h3>
          <MarkdownText text={summary} />
        </div>

        <div className="pt-6 border-t border-slate-800/50">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
              Key Takeaways
            </h3>
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
      </div>
    </div>
  );
}