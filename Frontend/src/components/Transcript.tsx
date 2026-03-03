import { FileText, Clock } from 'lucide-react';
import { TranscriptSegment } from '../types';

interface TranscriptProps {
  segments: TranscriptSegment[];
}

export default function Transcript({ segments }: TranscriptProps) {
  const handleTimestampClick = (seconds: number, timestamp: string) => {
    console.log(`Mock: Jumping to ${timestamp} (${seconds}s)`);
  };

  return (
    <div className="mt-6 bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden backdrop-blur-sm">
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-slate-200">Smart Transcript</h2>
        </div>
      </div>
      <div className="p-6 max-h-96 overflow-y-auto custom-scrollbar">
        <div className="space-y-4">
          {segments.map((segment, index) => (
            <div
              key={index}
              className="group flex gap-4 p-3 rounded-lg hover:bg-slate-800/30 transition-colors"
            >
              <button
                onClick={() => handleTimestampClick(segment.seconds, segment.timestamp)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 hover:bg-indigo-600/20 border border-slate-700/50 hover:border-indigo-500/50 rounded-lg transition-all group-hover:shadow-lg group-hover:shadow-indigo-500/10"
              >
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-sm font-mono text-indigo-400">
                  {segment.timestamp}
                </span>
              </button>
              <p className="text-slate-300 leading-relaxed">{segment.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}