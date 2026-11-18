import YouTube, { YouTubeEvent } from 'react-youtube';
import { PlayCircle, User, Clock } from 'lucide-react';
import { PlayerHandle, VideoMetadata } from '../types';
import { formatDuration } from '../lib/time';

interface VideoPlayerProps {
  videoId: string;
  title: string;
  metadata?: VideoMetadata;
  onReady?: (player: PlayerHandle) => void;
}

const opts = {
  height: '100%',
  width: '100%',
  playerVars: {
    autoplay: 0 as const,
    modestbranding: 1 as const,
    rel: 0 as const,
  },
};

export default function VideoPlayer({ videoId, title, metadata, onReady }: VideoPlayerProps) {
  return (
    <div className="bg-ink-900/50 border border-ink-800/50 rounded-2xl overflow-hidden backdrop-blur-sm">
      <div className="p-4 border-b border-ink-800/50">
        <div className="flex items-start gap-2">
          <PlayCircle className="w-5 h-5 text-turmeric-400 mt-1 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink-200 leading-snug">{title}</h2>
            {(metadata?.author || metadata?.duration) && (
              <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-ink-500">
                {metadata?.author && (
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {metadata.author}</span>
                )}
                {metadata?.duration ? (
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDuration(metadata.duration)}</span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
      <div id="video-player" className="relative w-full aspect-video bg-ink-950">
        <YouTube
          videoId={videoId}
          opts={opts}
          className="absolute inset-0 w-full h-full"
          iframeClassName="w-full h-full"
          onReady={(e: YouTubeEvent) => onReady?.(e.target as PlayerHandle)}
        />
      </div>
    </div>
  );
}
