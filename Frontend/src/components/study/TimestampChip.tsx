import { PlayCircle } from 'lucide-react';
import { parseTimestamp } from '../../lib/time';

interface TimestampChipProps {
  timestamp: string;
  onSeek?: (seconds: number) => void;
  label?: string;
}

/** Small "▶ 4:32" button that jumps the video. Renders nothing if the timestamp is invalid. */
export default function TimestampChip({ timestamp, onSeek, label }: TimestampChipProps) {
  const seconds = timestamp ? parseTimestamp(timestamp) : null;
  if (seconds === null || !onSeek) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onSeek(seconds); }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono text-xs hover:bg-indigo-500/30 transition-colors shrink-0"
      title={`Watch at ${timestamp}`}
    >
      <PlayCircle className="w-3 h-3" />
      {label ? `${label} ${timestamp}` : timestamp}
    </button>
  );
}
