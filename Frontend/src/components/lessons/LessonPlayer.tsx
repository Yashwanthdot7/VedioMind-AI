import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Maximize, Minimize, Subtitles, RotateCcw, Download, Loader2, Info, ListChecks, GraduationCap,
} from 'lucide-react';
import { Lesson, LessonQuizQuestion } from '../../types';
import { drawFrame, estimateDuration, HEIGHT, WIDTH } from '../../lib/lessonCanvas';
import { fetchLessonAudio, fetchLessonImage, generateLessonQuiz } from '../../services/apiService';
import { speak, stopSpeaking, hasVoiceFor } from '../../lib/speech';
import { errorMessage } from '../../lib/errors';
import { recordAttempt } from '../../lib/attempts';
import { navigate } from '../../lib/navigation';
import QuizView from '../study/QuizView';
import LessonExport from './LessonExport';

interface LessonPlayerProps {
  lesson: Lesson;
}

export default function LessonPlayer({ lesson }: LessonPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const useGeminiVoice = lesson.voiceMode === 'gemini';

  const [audioUrls, setAudioUrls] = useState<string[] | null>(useGeminiVoice ? null : []);
  const [audioBlobs, setAudioBlobs] = useState<Blob[]>([]);
  const [images, setImages] = useState<(ImageBitmap | null)[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [finished, setFinished] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  // Quizzes are made only when asked for (saves time while generating the video)
  const [quiz, setQuiz] = useState<{ kind: 'quick' | 'test'; questions: LessonQuizQuestion[] } | null>(
    lesson.quiz.length ? { kind: lesson.quizKind === 'test' ? 'test' : 'quick', questions: lesson.quiz } : null,
  );
  const [quizLoading, setQuizLoading] = useState<'quick' | 'test' | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const quizRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // Browser-voice clock (when there's no audio file)
  const clock = useRef({ startedAt: 0, offset: 0 });
  const stopSpeechRef = useRef<() => void>(() => {});

  const scene = lesson.scenes[sceneIndex];
  const sceneDuration = useCallback((i: number) => {
    const s = lesson.scenes[i];
    return s.duration || estimateDuration(s.narration);
  }, [lesson.scenes]);

  // ---- load narration audio
  useEffect(() => {
    if (!useGeminiVoice) return;
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      try {
        const blobs = await Promise.all(lesson.scenes.map((_, i) => fetchLessonAudio(lesson.id, i)));
        if (cancelled) return;
        blobs.forEach((b) => urls.push(URL.createObjectURL(b)));
        setAudioBlobs(blobs);
        setAudioUrls(urls);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Could not load the narration.'));
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [lesson.id, lesson.scenes, useGeminiVoice]);

  // ---- load scene pictures (a missing picture just means that scene shows the drawn slide)
  useEffect(() => {
    let cancelled = false;
    const loaded: (ImageBitmap | null)[] = [];
    Promise.all(lesson.scenes.map((s, i) => (s.image
      ? fetchLessonImage(lesson.id, i).catch(() => null)
      : Promise.resolve(null))))
      .then((bitmaps) => {
        loaded.push(...bitmaps);
        if (!cancelled) setImages(bitmaps);
      });
    return () => {
      cancelled = true;
      loaded.forEach((b) => b?.close());
    };
  }, [lesson.id, lesson.scenes]);

  const currentTime = useCallback(() => {
    if (useGeminiVoice) return audioRef.current?.currentTime ?? 0;
    const c = clock.current;
    return c.offset + (c.startedAt ? (performance.now() - c.startedAt) / 1000 : 0);
  }, [useGeminiVoice]);

  // ---- draw loop
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const tick = () => {
      const duration = sceneDuration(sceneIndex);
      const time = finished ? duration : Math.min(currentTime(), duration);
      drawFrame(ctx, {
        scene, sceneIndex, sceneCount: lesson.scenes.length, time, duration, lessonTitle: lesson.title, captions,
        image: images[sceneIndex] || null,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scene, sceneIndex, lesson.scenes.length, lesson.title, captions, finished, currentTime, sceneDuration, images]);

  // ---- move between scenes
  const next = useCallback(() => {
    if (sceneIndex + 1 < lesson.scenes.length) {
      setSceneIndex((i) => i + 1);
    } else {
      setPlaying(false);
      setFinished(true);
    }
  }, [sceneIndex, lesson.scenes.length]);

  // Start the current scene's narration whenever scene/playing changes
  useEffect(() => {
    if (!playing || finished) return;
    if (useGeminiVoice) {
      const audio = audioRef.current;
      if (!audio || !audioUrls) return;
      if (!audio.src.endsWith(audioUrls[sceneIndex])) {
        audio.src = audioUrls[sceneIndex];
        audio.currentTime = 0;
      }
      audio.play().catch(() => setPlaying(false));
      return () => audio.pause();
    }
    // browser voice: restart narration of this scene from the beginning
    const startedAt = performance.now();
    const minSeconds = sceneDuration(sceneIndex) * 0.8;
    let holdTimer = 0;
    clock.current = { startedAt, offset: 0 };
    const stopSpeech = speak(scene.narration, lesson.language, lesson.audience, () => {
      // If the browser finished instantly (e.g. no voice installed), keep the slide up long enough to read
      const elapsed = (performance.now() - startedAt) / 1000;
      const advance = () => {
        clock.current = { startedAt: 0, offset: sceneDuration(sceneIndex) };
        next();
      };
      if (elapsed < minSeconds) holdTimer = window.setTimeout(advance, (minSeconds - elapsed) * 1000);
      else advance();
    }, sceneDuration(sceneIndex) * 1.6 + 4);
    stopSpeechRef.current = stopSpeech;
    return () => {
      window.clearTimeout(holdTimer);
      stopSpeech();
    };
  }, [playing, sceneIndex, finished, useGeminiVoice, audioUrls, scene.narration, lesson.language, lesson.audience, next, sceneDuration]);

  // Reset the clock when switching scenes while paused
  useEffect(() => {
    clock.current = { startedAt: 0, offset: 0 };
    const audio = audioRef.current;
    // Only swap the source if the play effect hasn't already (re-setting src would stop playback)
    if (audio && audioUrls?.[sceneIndex] && !audio.src.endsWith(audioUrls[sceneIndex])) {
      audio.src = audioUrls[sceneIndex];
      audio.currentTime = 0;
    }
  }, [sceneIndex, audioUrls]);

  useEffect(() => () => stopSpeaking(), []);

  const picturesExpected = lesson.scenes.some((s) => s.image);
  const ready = audioUrls !== null && (!picturesExpected || images.length === lesson.scenes.length);

  const togglePlay = () => {
    if (!ready) return;
    if (finished) {
      setFinished(false);
      setShowQuiz(false);
      setSceneIndex(0);
      setPlaying(true);
      return;
    }
    if (playing && !useGeminiVoice) {
      // freeze the browser-voice clock
      clock.current = { startedAt: 0, offset: currentTime() };
    }
    setPlaying((p) => !p);
  };

  const goTo = (i: number) => {
    setFinished(false);
    setShowQuiz(false);
    setSceneIndex(Math.max(0, Math.min(lesson.scenes.length - 1, i)));
  };

  // ---- fullscreen
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else frameRef.current?.requestFullscreen?.();
  };

  // ---- keyboard: space = play/pause, ← → = scenes (when the player has focus)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowRight') goTo(sceneIndex + 1);
    else if (e.key === 'ArrowLeft') goTo(sceneIndex - 1);
    else if (e.key === 'f') toggleFullscreen();
  };

  const openQuiz = async (kind: 'quick' | 'test', refresh = false) => {
    if (document.fullscreenElement) document.exitFullscreen();
    setPlaying(false);
    setShowQuiz(true);
    setQuizError(null);
    if (!refresh && quiz?.kind === kind) {
      setTimeout(() => quizRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      return;
    }
    setQuizLoading(kind);
    try {
      setQuiz(await generateLessonQuiz(lesson.id, kind, refresh));
    } catch (err) {
      setQuizError(errorMessage(err, 'Could not create the quiz.'));
    } finally {
      setQuizLoading(null);
      setTimeout(() => quizRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  };

  const totalSeconds = lesson.scenes.reduce((n, _, i) => n + sceneDuration(i), 0);
  const browserVoiceMissing = !useGeminiVoice && !hasVoiceFor(lesson.language);

  return (
    <div className="space-y-4">
      {lesson.imageNotice && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-ink-800/60 border border-ink-700/60 text-ink-300 text-sm">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{lesson.imageNotice}</span>
        </div>
      )}
      {lesson.voiceNotice && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {lesson.voiceNotice}
            {browserVoiceMissing && ' Your computer has no voice installed for this language, so the reading may sound wrong — captions are on.'}
          </span>
        </div>
      )}

      <div
        ref={frameRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={`relative bg-black rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-500 ${fullscreen ? 'flex items-center justify-center' : ''}`}
      >
        <div className={`relative ${fullscreen ? 'w-full h-full flex items-center justify-center' : ''}`}>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onClick={togglePlay}
          className={`block w-full ${fullscreen ? 'h-full object-contain' : 'h-auto'} cursor-pointer`}
          aria-label={`Video lesson: ${lesson.title}`}
        />
        <audio ref={audioRef} onEnded={next} preload="auto" />

        {!ready && !loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-950/70 text-ink-300">
            <Loader2 className="w-8 h-8 animate-spin text-neon-400" />
            <span className="text-sm">Loading {picturesExpected ? 'pictures and narration' : 'narration'}…</span>
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/80 text-red-300 text-sm p-6 text-center">{loadError}</div>
        )}

        {ready && !playing && !finished && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center transition-colors"
            aria-label="Play"
          >
            <Play className="w-9 h-9 text-white ml-1" />
          </button>
        )}

        {finished && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink-950/75 backdrop-blur-sm">
            <p className="text-2xl font-bold text-white">🎉 Lesson complete!</p>
            <div className="flex gap-3">
              <button onClick={togglePlay} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm">
                <RotateCcw className="w-4 h-4" /> Watch again
              </button>
              <button
                onClick={() => openQuiz('quick')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-400 hover:bg-neon-500 text-white text-sm"
              >
                <ListChecks className="w-4 h-4" /> Quick quiz (5)
              </button>
              <button
                onClick={() => openQuiz('test')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-400 hover:bg-neon-500 text-white text-sm"
              >
                <GraduationCap className="w-4 h-4" /> Full test (10)
              </button>
            </div>
          </div>
        )}
        </div>

        {/* controls */}
        <div className={`flex items-center gap-1 px-3 py-2 bg-ink-900/90 ${fullscreen ? 'absolute bottom-0 left-0 right-0' : ''}`}>
          <button onClick={togglePlay} disabled={!ready} className="p-2 rounded-lg hover:bg-white/10 text-white disabled:opacity-40" aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button onClick={() => goTo(sceneIndex - 1)} disabled={sceneIndex === 0} className="p-2 rounded-lg hover:bg-white/10 text-white disabled:opacity-30" aria-label="Previous scene">
            <SkipBack className="w-4 h-4" />
          </button>
          <button onClick={() => goTo(sceneIndex + 1)} disabled={sceneIndex >= lesson.scenes.length - 1} className="p-2 rounded-lg hover:bg-white/10 text-white disabled:opacity-30" aria-label="Next scene">
            <SkipForward className="w-4 h-4" />
          </button>
          <span className="ml-2 text-xs text-ink-400 tabular-nums">
            Scene {sceneIndex + 1}/{lesson.scenes.length} · ~{Math.max(1, Math.round(totalSeconds / 60))} min
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setCaptions((c) => !c)}
              className={`p-2 rounded-lg hover:bg-white/10 ${captions ? 'text-neon-300' : 'text-ink-500'}`}
              aria-label={captions ? 'Hide captions' : 'Show captions'}
              aria-pressed={captions}
            >
              <Subtitles className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setPlaying(false); setExporting(true); }}
              disabled={!ready}
              className="p-2 rounded-lg hover:bg-white/10 text-white disabled:opacity-40"
              aria-label="Download video"
              title="Download video"
            >
              <Download className="w-5 h-5" />
            </button>
            <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-white/10 text-white" aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
              {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* scene strip */}
      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
        {lesson.scenes.map((s, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`shrink-0 w-40 p-2.5 rounded-xl border text-left transition-colors ${
              i === sceneIndex ? 'border-neon-500/60 bg-neon-500/10' : 'border-ink-800 bg-ink-900/50 hover:border-ink-700'
            }`}
          >
            <span className="text-xl">{s.icon}</span>
            <p className="text-xs text-ink-300 mt-1 line-clamp-2 leading-snug">{s.heading}</p>
          </button>
        ))}
      </div>

      {/* Test yourself: generated only when asked for */}
      <div ref={quizRef} className="p-5 rounded-2xl bg-ink-900/50 border border-ink-800/50 scroll-mt-28">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h3 className="text-lg font-semibold text-ink-100">Test yourself</h3>
            <p className="text-xs text-ink-500">Made from this lesson when you ask, in {lesson.language === 'en' ? 'English' : 'the lesson’s language'}</p>
          </div>
          <button
            onClick={() => openQuiz('quick', quiz?.kind === 'quick')}
            disabled={quizLoading !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-400 hover:bg-neon-500 disabled:opacity-50 text-white text-sm"
          >
            {quizLoading === 'quick' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
            {quiz?.kind === 'quick' && showQuiz ? 'New quick quiz' : 'Quick quiz (5)'}
          </button>
          <button
            onClick={() => openQuiz('test', quiz?.kind === 'test')}
            disabled={quizLoading !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-400 hover:bg-neon-500 disabled:opacity-50 text-white text-sm"
          >
            {quizLoading === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
            {quiz?.kind === 'test' && showQuiz ? 'New full test' : 'Full test (10)'}
          </button>
        </div>

        {showQuiz && (
          <div className="mt-5">
            {quizLoading && (
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-ink-400">
                <Loader2 className="w-5 h-5 animate-spin text-neon-400" /> Writing your {quizLoading === 'test' ? 'test' : 'quiz'}… (about 10 seconds)
              </p>
            )}
            {quizError && !quizLoading && <p className="text-sm text-red-400 py-4">{quizError}</p>}
            {quiz && !quizLoading && (
              <QuizView
                key={`${quiz.kind}-${quiz.questions[0]?.question}`}
                quiz={{ questions: quiz.questions }}
                videoTitle={lesson.title}
                onOpenAnalytics={() => navigate('analytics')}
                onComplete={async (result) => (await recordAttempt({
                  source: 'lesson', kind: quiz.kind, title: lesson.title, language: lesson.language, level: lesson.audience,
                  lessonId: lesson.id, videoId: lesson.sourceVideo?.videoId ?? null, ...result,
                })).where}
              />
            )}
          </div>
        )}
      </div>

      {exporting && (
        <LessonExport lesson={lesson} audioBlobs={audioBlobs} images={images} captions={captions} onClose={() => setExporting(false)} />
      )}
    </div>
  );
}
