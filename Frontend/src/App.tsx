import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Languages, ArrowLeft, Cloud, CloudOff, Clapperboard } from 'lucide-react';
import Header from './components/Header';
import VideoPlayer from './components/VideoPlayer';
import Transcript from './components/Transcript';
import AIInsights from './components/AIInsights';
import Chat from './components/Chat';
import ProcessingOverlay from './components/ProcessingOverlay';
import AuthModal from './components/AuthModal';
import Library from './components/Library';
import StudyTools from './components/study/StudyTools';
import LessonsPage from './components/lessons/LessonsPage';
import { useAuth } from './context/AuthContext';
import { ProcessingStatus, VideoData, Message, ProcessingStep, PlayerHandle, LibraryItem } from './types';
import { processVideo, sendChat, getLibraryEntry, clearChat } from './services/apiService';
import { DEFAULT_LANGUAGE, LANGUAGES, languageLabel } from './constants/languages';
import { errorMessage } from './lib/errors';

type View = 'home' | 'dashboard' | 'library' | 'lessons';

const STEP_LABELS = ['Fetching video & captions', 'Generating AI insights', 'Preparing your dashboard'];
const freshSteps = (): ProcessingStep[] => STEP_LABELS.map((label) => ({ label, completed: false }));

const LANGUAGE_STORAGE_KEY = 'videomind.language';

function loadLanguage(): string {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_LANGUAGE;
}

const greeting = (video: VideoData): Message => ({
  id: 'greeting',
  role: 'assistant',
  content: `Hello! I've analysed **${video.title}**. Ask me anything about it — I'll point you to the exact moment in the video, like [0:00].`,
  timestamp: new Date(),
});

function App() {
  const { user, enabled: authEnabled } = useAuth();

  const [view, setView] = useState<View>('home');
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>(loadLanguage);
  const [authOpen, setAuthOpen] = useState(false);
  const [lessonFromVideo, setLessonFromVideo] = useState(false);

  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>(freshSteps);
  const [progress, setProgress] = useState(0);

  const playerRef = useRef<PlayerHandle | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      /* storage unavailable */
    }
  }, [language]);

  // Track playback position so the transcript can highlight the current line
  useEffect(() => {
    if (view !== 'dashboard') return;
    const id = window.setInterval(async () => {
      const player = playerRef.current;
      if (!player) return;
      try {
        const t = await player.getCurrentTime();
        if (typeof t === 'number' && !Number.isNaN(t)) setCurrentTime(t);
      } catch {
        /* player not ready */
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [view]);

  const seekTo = useCallback((seconds: number) => {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(seconds, true);
    player.playVideo();
    setCurrentTime(seconds);
    document.getElementById('video-player')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const showVideo = (video: VideoData, history: Message[] = []) => {
    playerRef.current = null;
    setCurrentTime(0);
    setVideoData(video);
    setMessages([greeting(video), ...history]);
    setView('dashboard');
    window.scrollTo({ top: 0 });
  };

  const handleSummarize = async (url: string, lang: string = language) => {
    setStatus(ProcessingStatus.LOADING);
    setError(null);
    setNotice(null);
    setProgress(5);
    setProcessingSteps(freshSteps());

    // The server does everything in one request, so progress is an estimate
    // that eases towards 90% and completes when the response arrives.
    const started = Date.now();
    const ticker = window.setInterval(() => {
      const elapsed = (Date.now() - started) / 1000;
      const estimate = Math.min(90, Math.round(90 * (1 - Math.exp(-elapsed / 12))));
      setProgress((p) => Math.max(p, estimate));
      if (elapsed > 4) setProcessingSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, completed: true } : s)));
    }, 400);

    try {
      const { data, cached, saved } = await processVideo(url, lang);
      window.clearInterval(ticker);
      setProcessingSteps(STEP_LABELS.map((label) => ({ label, completed: true })));
      setProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 350));

      let history: Message[] = [];
      if (saved && data.analysisId) {
        // Restore an earlier conversation about this video, if any
        try {
          const entry = await getLibraryEntry(data.analysisId);
          history = entry.chat.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
        } catch {
          /* history is optional */
        }
      }

      showVideo(data, history);
      setStatus(ProcessingStatus.SUCCESS);
      if (cached) setNotice('Loaded instantly — this video was analysed before.');
    } catch (err) {
      window.clearInterval(ticker);
      console.error('Error processing video:', err);
      setError(errorMessage(err, 'Failed to process video. Please try again.'));
      setStatus(ProcessingStatus.ERROR);
      setProgress(0);
      setProcessingSteps(freshSteps());
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!videoData || isTyping) return;

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    // The greeting is UI-only; don't send it to the model
    const history = [...messages.filter((m) => m.id !== 'greeting'), userMessage];
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const answer = await sendChat(videoData, history);
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: answer,
        timestamp: new Date(),
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I couldn't answer that: ${errorMessage(err, 'please try again.')}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = async () => {
    if (!videoData) return;
    if (user && videoData.analysisId) {
      try {
        await clearChat(videoData.analysisId);
      } catch (err) {
        setError(errorMessage(err));
        return;
      }
    }
    setMessages([greeting(videoData)]);
  };

  const openLibraryItem = async (item: LibraryItem) => {
    setStatus(ProcessingStatus.LOADING);
    setProgress(60);
    setProcessingSteps(STEP_LABELS.map((label, i) => ({ label, completed: i < 2 })));
    try {
      const entry = await getLibraryEntry(item.analysisId);
      showVideo(entry.analysis, entry.chat.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })));
      setStatus(ProcessingStatus.SUCCESS);
      setNotice(null);
    } catch (err) {
      setStatus(ProcessingStatus.ERROR);
      setError(errorMessage(err));
    }
  };

  const openLessons = (fromVideo = false) => {
    setLessonFromVideo(fromVideo);
    setError(null);
    setView('lessons');
    window.scrollTo({ top: 0 });
  };

  const openLibrary = () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setError(null);
    setView('library');
    window.scrollTo({ top: 0 });
  };

  // If the user signs out while on the library page, go home
  useEffect(() => {
    if (!user && view === 'library') setView('home');
  }, [user, view]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Header
        onSummarize={(url) => handleSummarize(url)}
        status={status}
        language={language}
        onLanguageChange={setLanguage}
        onOpenLibrary={openLibrary}
        onOpenLessons={() => openLessons(false)}
        onOpenAuth={() => setAuthOpen(true)}
        onGoHome={() => { setView('home'); setError(null); }}
      />

      <ProcessingOverlay
        isVisible={status === ProcessingStatus.LOADING}
        steps={processingSteps}
        progress={progress}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <AnimatePresence mode="wait">
        {view === 'lessons' ? (
          <motion.div
            key={`lessons-${lessonFromVideo}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pt-36 md:pt-28 pb-16 px-4"
          >
            <LessonsPage currentVideo={videoData} preferVideo={lessonFromVideo} defaultLanguage={videoData?.language || language} />
          </motion.div>
        ) : view === 'library' && user ? (
          <motion.div
            key="library"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pt-36 md:pt-28 pb-16 px-4"
          >
            <Library onOpen={openLibraryItem} />
          </motion.div>
        ) : view === 'dashboard' && videoData ? (
          <motion.div
            key={`dashboard-${videoData.videoId}-${videoData.language}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="pt-36 md:pt-28 pb-16 px-4"
          >
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
                <button
                  onClick={() => setView(user ? 'library' : 'home')}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200"
                >
                  <ArrowLeft className="w-4 h-4" /> {user ? 'Library' : 'Home'}
                </button>
                {authEnabled && (
                  user && videoData.analysisId ? (
                    <span className="flex items-center gap-1.5 text-emerald-400/80"><Cloud className="w-4 h-4" /> Saved to your library</span>
                  ) : !user ? (
                    <button onClick={() => setAuthOpen(true)} className="flex items-center gap-1.5 text-amber-300/80 hover:text-amber-200">
                      <CloudOff className="w-4 h-4" /> Sign in to save this video and chat
                    </button>
                  ) : null
                )}
                {notice && <span className="text-slate-500">{notice}</span>}
                <button
                  onClick={() => openLessons(true)}
                  className={`${language !== videoData.language ? '' : 'ml-auto '}flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600/80 to-purple-600/80 hover:from-indigo-500 hover:to-purple-500 text-white`}
                >
                  <Clapperboard className="w-4 h-4" /> Make a video lesson
                </button>
                {language !== videoData.language && (
                  <button
                    onClick={() => handleSummarize(`https://youtu.be/${videoData.videoId}`, language)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25"
                  >
                    <Languages className="w-4 h-4" /> Show this video in {languageLabel(language)}
                  </button>
                )}
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 space-y-6">
                  <VideoPlayer
                    videoId={videoData.videoId}
                    title={videoData.title}
                    metadata={videoData.metadata}
                    onReady={(player) => { playerRef.current = player; }}
                  />
                  <Transcript segments={videoData.transcript} currentTime={currentTime} onSeek={seekTo} />
                  {/* Chat below Smart Transcript */}
                  <Chat
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    videoTitle={videoData.title}
                    isTyping={isTyping}
                    onSeek={seekTo}
                    onClear={handleClearChat}
                  />
                </div>

                {/* Insights stay in view while you scroll the transcript and chat */}
                <div className="lg:col-span-2 lg:sticky lg:top-28 lg:self-start">
                  <AIInsights summary={videoData.summary} keyTakeaways={videoData.keyTakeaways} onSeek={seekTo} scrollable />
                </div>
              </div>

              {/* Full width: room for notes, quiz, flashcards and the mind map */}
              <div className="mt-6">
                <StudyTools key={`${videoData.videoId}:${videoData.language}`} video={videoData} onSeek={seekTo} />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pt-40 md:pt-32 pb-16 px-4"
          >
            <div className="max-w-2xl mx-auto text-center">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="mb-8"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/30 mb-6">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Transform Videos into Insights
                </h1>
                <p className="text-lg text-slate-400 max-w-lg mx-auto">
                  Paste any YouTube URL above to get AI-powered summaries, transcripts and interactive Q&amp;A — in {languageLabel(language)} or 14 other languages.
                </p>
              </motion.div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400"
                >
                  {error}
                </motion.div>
              )}

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12"
              >
                {[
                  { icon: '📝', title: 'Smart Transcripts', desc: 'Searchable, time-stamped — click any line to jump there' },
                  { icon: '🧠', title: 'AI Insights & Study Tools', desc: 'Summaries, notes, quizzes, flashcards & mind maps in your language' },
                  { icon: '💬', title: 'Interactive Chat', desc: 'Ask questions, get answers with timestamps' },
                ].map((feature) => (
                  <div
                    key={feature.title}
                    className="p-6 bg-slate-900/50 border border-slate-800/50 rounded-2xl backdrop-blur-sm hover:border-indigo-500/30 transition-all"
                  >
                    <div className="text-4xl mb-3">{feature.icon}</div>
                    <h3 className="text-lg font-semibold text-slate-200 mb-2">{feature.title}</h3>
                    <p className="text-sm text-slate-400">{feature.desc}</p>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
