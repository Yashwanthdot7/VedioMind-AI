import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Languages, Cloud, CloudOff, Clapperboard } from 'lucide-react';
import Sidebar from './components/shell/Sidebar';
import MobileNav from './components/shell/MobileNav';
import LinkBar from './components/shell/LinkBar';
import HomePage from './components/home/HomePage';
import VideoPlayer from './components/VideoPlayer';
import Transcript from './components/Transcript';
import AIInsights from './components/AIInsights';
import Chat from './components/Chat';
import ProcessingOverlay from './components/ProcessingOverlay';
import AuthModal from './components/AuthModal';
import Library from './components/Library';
import StudyTools from './components/study/StudyTools';
import LessonsPage from './components/lessons/LessonsPage';
import AnalyticsPage from './components/analytics/AnalyticsPage';
import { AppView, onNavigate } from './lib/navigation';
import { useAuth } from './context/AuthContext';
import { ProcessingStatus, VideoData, Message, ProcessingStep, PlayerHandle, LibraryItem } from './types';
import { processVideo, sendChat, getLibraryEntry, clearChat } from './services/apiService';
import { DEFAULT_LANGUAGE, LANGUAGES, languageLabel } from './constants/languages';
import { errorMessage } from './lib/errors';

type View = AppView;

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
  const [lessonTopic, setLessonTopic] = useState('');

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
    setLessonTopic('');
    setError(null);
    setView('lessons');
    window.scrollTo({ top: 0 });
  };

  const openAnalytics = () => {
    setError(null);
    setView('analytics');
    window.scrollTo({ top: 0 });
  };

  // Deep components (quiz score screens, empty states) can ask to change page
  useEffect(() => onNavigate((target) => {
    if (target === 'dashboard' && !videoData) return;
    setView(target);
    window.scrollTo({ top: 0 });
  }), [videoData]);

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

  const goHome = () => { setView('home'); setError(null); window.scrollTo({ top: 0 }); };
  const navigateTo = (target: View) => {
    if (target === 'home') goHome();
    else if (target === 'library') openLibrary();
    else if (target === 'lessons') openLessons(false);
    else if (target === 'analytics') openAnalytics();
    else if (target === 'dashboard' && videoData) { setView('dashboard'); window.scrollTo({ top: 0 }); }
  };
  const makeLesson = (topic: string) => {
    setLessonTopic(topic);
    setLessonFromVideo(false);
    setError(null);
    setView('lessons');
    window.scrollTo({ top: 0 });
  };
  const busy = status === ProcessingStatus.LOADING;
  const page = 'px-4 lg:px-10 pt-6 lg:pt-8 pb-28 lg:pb-16';
  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } };

  return (
    <div className="min-h-screen bg-ink-950">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-turmeric-400 focus:text-ink-950">Skip to content</a>
      <Sidebar
        view={view}
        hasVideo={!!videoData}
        videoTitle={videoData?.title}
        onNavigate={navigateTo}
        onOpenAuth={() => setAuthOpen(true)}
      />
      <MobileNav view={view} onNavigate={navigateTo} onOpenAuth={() => setAuthOpen(true)} />

      <ProcessingOverlay isVisible={busy} steps={processingSteps} progress={progress} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <div className="lg:pl-64">
        {view !== 'home' && (
          <LinkBar
            busy={busy}
            language={language}
            onLanguageChange={setLanguage}
            onSummarize={(url) => handleSummarize(url)}
            onGoHome={goHome}
            onOpenAuth={() => setAuthOpen(true)}
          />
        )}

        <main id="main">
          <AnimatePresence mode="wait">
            {view === 'analytics' ? (
              <motion.div key="analytics" {...fade} className={page}>
                <AnalyticsPage />
              </motion.div>
            ) : view === 'lessons' ? (
              <motion.div key={`lessons-${lessonFromVideo}-${lessonTopic}`} {...fade} className={page}>
                <LessonsPage
                  currentVideo={videoData}
                  preferVideo={lessonFromVideo}
                  defaultLanguage={lessonFromVideo ? videoData?.language || language : language}
                  initialText={lessonTopic}
                />
              </motion.div>
            ) : view === 'library' && user ? (
              <motion.div key="library" {...fade} className={page}>
                <Library onOpen={openLibraryItem} />
              </motion.div>
            ) : view === 'dashboard' && videoData ? (
              <motion.div key={`dashboard-${videoData.videoId}-${videoData.language}`} {...fade} className={page}>
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
                {authEnabled && (
                  user && videoData.analysisId ? (
                    <span className="flex items-center gap-1.5 text-lagoon-400/80"><Cloud className="w-4 h-4" /> Saved to your library</span>
                  ) : !user ? (
                    <button onClick={() => setAuthOpen(true)} className="flex items-center gap-1.5 text-amber-300/80 hover:text-amber-200">
                      <CloudOff className="w-4 h-4" /> Sign in to save this video and chat
                    </button>
                  ) : null
                )}
                {notice && <span className="text-ink-500">{notice}</span>}
                <button
                  onClick={() => openLessons(true)}
                  className={`${language !== videoData.language ? '' : 'ml-auto '}flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-turmeric-400 text-ink-950 font-medium hover:bg-turmeric-300`}
                >
                  <Clapperboard className="w-4 h-4" /> Make a video lesson
                </button>
                {language !== videoData.language && (
                  <button
                    onClick={() => handleSummarize(`https://youtu.be/${videoData.videoId}`, language)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-turmeric-500/15 border border-turmeric-500/30 text-turmeric-300 hover:bg-turmeric-500/25"
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
                  {/* Chat below Transcript */}
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
                <div className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
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
              <motion.div key="home" {...fade}>
                {error && (
                  <div role="alert" className="max-w-5xl mx-auto px-5 lg:px-10 pt-6">
                    <p className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300">{error}</p>
                  </div>
                )}
                <HomePage
                  busy={busy}
                  language={language}
                  onLanguageChange={setLanguage}
                  onSummarize={(url) => handleSummarize(url)}
                  onMakeLesson={makeLesson}
                  onOpenLibraryItem={openLibraryItem}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
