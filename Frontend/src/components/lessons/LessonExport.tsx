import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2, Film, AlertTriangle } from 'lucide-react';
import { Lesson } from '../../types';
import { drawFrame, estimateDuration, HEIGHT, WIDTH } from '../../lib/lessonCanvas';
import { slugify } from '../../lib/download';
import { errorMessage } from '../../lib/errors';

interface LessonExportProps {
  lesson: Lesson;
  audioBlobs: Blob[];
  images: (ImageBitmap | null)[];
  captions: boolean;
  onClose: () => void;
}

/** Best format this browser can record: MP4 where supported (Chrome/Edge/Safari), else WebM */
function pickMimeType(): { mime: string; ext: 'mp4' | 'webm' } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates: [string, 'mp4' | 'webm'][] = [
    ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'],
    ['video/mp4;codecs=avc1,mp4a', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'webm'],
    ['video/webm;codecs=vp8,opus', 'webm'],
    ['video/webm', 'webm'],
  ];
  for (const [mime, ext] of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return null;
}

type Phase = 'intro' | 'recording' | 'done' | 'error';

/**
 * Records the lesson in real time: draws frames on a canvas and plays the
 * narration through Web Audio into a MediaRecorder. 100% in the browser, free.
 */
export default function LessonExport({ lesson, audioBlobs, images, captions, onClose }: LessonExportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cancelRef = useRef<() => void>(() => {});
  const [phase, setPhase] = useState<Phase>('intro');
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; ext: string; size: number } | null>(null);

  const format = pickMimeType();
  const hasAudio = lesson.voiceMode === 'gemini' && audioBlobs.length === lesson.scenes.length;
  const durations = lesson.scenes.map((s) => s.duration || estimateDuration(s.narration));
  const total = durations.reduce((a, b) => a + b, 0) + 1.5; // + short end card

  useEffect(() => () => {
    cancelRef.current();
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  const start = async () => {
    if (!format) return;
    setPhase('recording');
    setProgress(0);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let cancelled = false;
    let raf = 0;
    const audioCtx = new AudioContext();

    try {
      // Decode narration and lay the scenes out back-to-back on one timeline
      const buffers = hasAudio
        ? await Promise.all(audioBlobs.map(async (b) => audioCtx.decodeAudioData(await b.arrayBuffer())))
        : [];
      const sceneDurations = hasAudio ? buffers.map((b) => b.duration) : durations;
      const starts: number[] = [];
      sceneDurations.reduce((t, d, i) => { starts[i] = t; return t + d; }, 0);
      const length = sceneDurations.reduce((a, b) => a + b, 0) + 1.5;

      const videoStream = canvas.captureStream(30);
      const dest = audioCtx.createMediaStreamDestination();
      const tracks = [...videoStream.getVideoTracks(), ...(hasAudio ? dest.stream.getAudioTracks() : [])];
      const recorder = new MediaRecorder(new MediaStream(tracks), {
        mimeType: format.mime,
        videoBitsPerSecond: 4_000_000,
        audioBitsPerSecond: 128_000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

      const finished = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

      // first frame before recording starts
      drawFrame(ctx, {
        scene: lesson.scenes[0], sceneIndex: 0, sceneCount: lesson.scenes.length, time: 0, duration: sceneDurations[0],
        lessonTitle: lesson.title, captions, image: images[0] || null,
      });
      recorder.start(1000);

      const t0 = audioCtx.currentTime + 0.15;
      if (hasAudio) {
        buffers.forEach((buffer, i) => {
          const src = audioCtx.createBufferSource();
          src.buffer = buffer;
          src.connect(dest);
          src.start(t0 + starts[i]);
        });
      }

      cancelRef.current = () => {
        cancelled = true;
        cancelAnimationFrame(raf);
        if (recorder.state !== 'inactive') recorder.stop();
        audioCtx.close().catch(() => {});
      };

      const frame = () => {
        if (cancelled) return;
        const t = Math.max(0, audioCtx.currentTime - t0);
        let i = starts.findIndex((s, k) => t >= s && (k === starts.length - 1 || t < starts[k + 1]));
        if (i < 0) i = 0;
        const inScene = Math.min(t - starts[i], sceneDurations[i]);
        drawFrame(ctx, {
          scene: lesson.scenes[i], sceneIndex: i, sceneCount: lesson.scenes.length,
          time: inScene, duration: sceneDurations[i], lessonTitle: lesson.title, captions, image: images[i] || null,
        });
        setProgress(Math.min(100, Math.round((t / length) * 100)));
        setElapsed(t);
        if (t >= length) {
          recorder.stop();
          return;
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      await finished;
      audioCtx.close().catch(() => {});
      if (cancelled) return;

      const blob = new Blob(chunks, { type: format.mime.split(';')[0] });
      setResult({ url: URL.createObjectURL(blob), ext: format.ext, size: blob.size });
      setPhase('done');
    } catch (err) {
      cancelRef.current();
      setError(errorMessage(err, 'Recording failed.'));
      setPhase('error');
    }
  };

  const close = () => {
    cancelRef.current();
    onClose();
  };

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-ink-950/90 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Download video">
      <div className="w-full max-w-3xl bg-ink-900 border border-ink-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-800">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-ink-100"><Film className="w-5 h-5 text-neon-400" /> Download video</h3>
          <button onClick={close} className="p-2 rounded-full hover:bg-ink-800 text-ink-400" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className={`w-full rounded-xl bg-black ${phase === 'intro' ? 'hidden' : ''}`} />

          {phase === 'intro' && (
            <div className="space-y-3 text-sm text-ink-300">
              {!format ? (
                <p className="flex items-start gap-2 text-amber-300"><AlertTriangle className="w-4 h-4 mt-0.5" /> This browser can't record video. Please use Chrome or Edge.</p>
              ) : (
                <>
                  <p>
                    The video is recorded in your browser while it plays, so this takes about <strong className="text-white">{mmss(total)}</strong>.
                    Keep this tab open until it finishes.
                  </p>
                  <p className="text-ink-500">
                    Format: <span className="text-ink-300">{format.ext}</span>
                    {format.ext === 'webm' && ' (your browser can’t record MP4; WebM plays in Chrome, VLC and on YouTube)'}
                    {captions ? ' · captions included' : ' · no captions'}
                  </p>
                  {!hasAudio && (
                    <p className="flex items-start gap-2 text-amber-300">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      This lesson uses your browser's voice, which can't be recorded — the video will be silent with captions.
                    </p>
                  )}
                  <button onClick={start} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-neon-400 hover:bg-neon-500 text-white font-medium">
                    <Film className="w-4 h-4" /> Start recording
                  </button>
                </>
              )}
            </div>
          )}

          {phase === 'recording' && (
            <div className="space-y-2">
              <div className="h-2 bg-ink-800 rounded-full overflow-hidden">
                <div className="h-full transition-all bg-neon-400 text-white" style={{ width: `${progress}%` }} />
              </div>
              <p className="flex items-center gap-2 text-sm text-ink-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Recording… {mmss(elapsed)} / {mmss(total)} — keep this tab open
              </p>
            </div>
          )}

          {phase === 'done' && result && (
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={result.url}
                download={`${slugify(lesson.title)}.${result.ext}`}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-aqua-600 hover:bg-aqua-500 text-white font-medium"
              >
                <Download className="w-4 h-4" /> Save {result.ext.toUpperCase()} ({(result.size / 1_048_576).toFixed(1)} MB)
              </a>
              <span className="text-sm text-ink-500">Ready! Share it, upload it, or play it offline.</span>
            </div>
          )}

          {phase === 'error' && (
            <p className="flex items-start gap-2 text-sm text-red-300"><AlertTriangle className="w-4 h-4 mt-0.5" /> {error}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
