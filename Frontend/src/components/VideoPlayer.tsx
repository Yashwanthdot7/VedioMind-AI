import YouTube from 'react-youtube';
import { PlayCircle } from 'lucide-react';

interface VideoPlayerProps {
  videoId: string;
  title: string;
}

export default function VideoPlayer({ videoId, title }: VideoPlayerProps) {
  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      modestbranding: 1,
      rel: 0,
    },
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden backdrop-blur-sm">
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-slate-200">{title}</h2>
        </div>
      </div>
      <div className="relative w-full aspect-video bg-slate-950">
        <YouTube
          videoId={videoId}
          opts={opts}
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  );
}