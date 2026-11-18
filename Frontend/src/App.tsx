import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Languages, Cloud, CloudOff, Clapperboard } from 'lucide-react';
import Header from './components/shell/Header';
import MenuOverlay from './components/shell/MenuOverlay';
import BootLoader from './components/shell/BootLoader';
import LearnerSettings from './components/learner/LearnerSettings';
import LinkBar from './components/shell/LinkBar';
import HomePage from './components/home/HomePage';
import SharedPage from './components/share/SharedPage';
import { sampleFor } from './data/sampleLessons';
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
import { ProcessingStatus, VideoData, Message, ProcessingStep, PlayerHandle, LibraryItem, Lesson, LearnerLevel } from './types';
import { processVideo, sendChat, getLibraryEntry, clearChat, getSummaryForLevel } from './services/apiService';
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

/** A class link looks like /?s=<slug> */
function readShareSlug(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('s');
  } catch {
    return null;
  }
}

function App() {
  const { user, enabled: authEnabled, loading: authLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const [sharedSlug, setSharedSlug] = useState<string | null>(readShareSlug);
  const [view, setView] = useState<View>(() => (readShareSlug() ? 'shared' : 'home'));
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  // Summaries already fetched for this video, per level, so switching back is instant
  const summaryByLevel = useRef<Partial<Record<LearnerLevel, { summary: string; keyTakeaways: string[] }>>>({});
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryNotice, setSummaryNotice] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>(loadLanguage);
  const [authOpen, setAuthOpen] = useState(false);
  const [lessonFromVideo, setLessonFromVideo] = useState(false);
  const [lessonTopic, setLessonTopic] = useState('');
  const [sampleLesson, setSampleLesson] = useState<Lesson | null>(null);

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
    summaryByLevel.current = {};
    setSummaryNotice(null);
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
    setSampleLesson(null);
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

  // Leaving a shared lesson: drop ?s= from the address so a refresh doesn't reopen it
  useEffect(() => {
    if (view !== 'shared' && sharedSlug) {
      setSharedSlug(null);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [view, sharedSlug]);

  const goHome = () => { setView('home'); setError(null); window.scrollTo({ top: 0 }); };
  const navigateTo = (target: View) => {
    if (target === 'home') goHome();
    else if (target === 'library') openLibrary();
    else if (target === 'lessons') openLessons(false);
    else if (target === 'analytics') openAnalytics();
    else if (target === 'dashboard' && videoData) { setView('dashboard'); window.scrollTo({ top: 0 }); }
  };
  const makeLesson = (topic: string) => {
    setSampleLesson(null);
    setLessonTopic(topic);
    setLessonFromVideo(false);
    setError(null);
    setView('lessons');
    window.scrollTo({ top: 0 });
  };
  /** Rewrite the summary for another level (cached per level for this video) */
  const changeSummaryLevel = async (level: LearnerLevel) => {
    if (!videoData || level === (videoData.level || 'intermediate')) return;
    const current = videoData.level || 'intermediate';
    summaryByLevel.current[current] ||= { summary: videoData.summary, keyTakeaways: videoData.keyTakeaways };
    const cached = summaryByLevel.current[level];
    if (cached) {
      setVideoData((v) => (v ? { ...v, ...cached, level } : v));
      return;
    }
    setSummaryBusy(true);
    setSummaryNotice(null);
    try {
      const r = await getSummaryForLevel(videoData, level);
      summaryByLevel.current[level] = { summary: r.summary, keyTakeaways: r.keyTakeaways };
      setVideoData((v) => (v ? { ...v, summary: r.summary, keyTakeaways: r.keyTakeaways, level, levelNotice: undefined } : v));
    } catch (err) {
      setSummaryNotice(errorMessage(err, 'Could not rewrite the summary. Please try again.'));
    } finally {
      setSummaryBusy(false);
    }
  };

  /** Ready-made lessons play straight away; other topics open the lesson form */
  const playLesson = (topic: string) => {
    const sample = sampleFor(topic);
    if (!sample) { makeLesson(topic); return; }
    setSampleLesson(sample);
    setLessonTopic('');
    setLessonFromVideo(false);
    setError(null);
    setView('lessons');
    window.scrollTo({ top: 0 });
  };
  const busy = status === ProcessingStatus.LOADING;
  const page = 'mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-10 pt-8 pb-20';
  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } };

  return (
    <div className="min-h-screen bg-ink-950">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-neon-400 focus:text-white">Skip to content</a>
      <BootLoader loading={authLoading} />
      <Header
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((o) => !o)}
        onGoHome={() => { setMenuOpen(false); goHome(); }}
        onOpenAuth={() => setAuthOpen(true)}
        onCreate={() => { setMenuOpen(false); makeLesson(''); }}
        overArt={view === 'home'}
      />
      <MenuOverlay
        open={menuOpen}
        view={view}
        hasVideo={!!videoData}
        videoTitle={videoData?.title}
        onClose={() => setMenuOpen(false)}
        onNavigate={navigateTo}
        onOpenAuth={() => setAuthOpen(true)}
      />

      <ProcessingOverlay isVisible={busy} steps={processingSteps} progress={progress} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <LearnerSettings />

      <div className={view === 'home' ? '' : 'relative pt-[76px]'}>
        {view !== 'home' && (
          // The portal's glow carries into every inner page, so it feels like the same place
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px] overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0" style={{ background: 'radial-gradient(50% 70% at 78% 0%, rgba(0,229,255,0.22), transparent 70%), radial-gradient(40% 60% at 15% 10%, rgba(138,79,214,0.22), transparent 70%)' }} />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink-950" />
          </div>
        )}
        {view !== 'home' && (
          <LinkBar
            busy={busy}
            language={language}
            onLanguageChange={setLanguage}
            onSummarize={(url) => handleSummarize(url)}
          />
        )}

        <main id="main" className="relative">
          <AnimatePresence mode="wait">
            {view === 'shared' && sharedSlug ? (
              <motion.div key={`shared-${sharedSlug}`} {...fade} className={page}>
                <SharedPage slug={sharedSlug} onMakeOwn={() => navigateTo('lessons')} />
              </motion.div>
            ) : view === 'analytics' ? (
              <motion.div key="analytics" {...fade} className={page}>
                <AnalyticsPage />
              </motion.div>
            ) : view === 'lessons' ? (
              <motion.div key={`lessons-${lessonFromVideo}-${lessonTopic}-${sampleLesson?.id || ''}`} {...fade} className={page}>
                <LessonsPage
                  currentVideo={videoData}
                  preferVideo={lessonFromVideo}
                  defaultLanguage={lessonFromVideo ? videoData?.language || language : language}
                  initialText={lessonTopic}
                  initialLesson={sampleLesson}
                />
              </motion.div>
            ) : view === 'library' && user ? (
              <motion.div key="library" {...fade} className={page}>
                <Library onOpen={openLibraryItem} />
              </motion.div>
            ) : view === 'dashboard' && videoData ? (
              <motion.div key={`dashboard-${videoData.videoId}-${videoData.language}`} {...fade} className={page}>
            <div className="max-w-7xl mx-auto">
              <h1 className="mb-1 font-display text-4xl text-white md:text-6xl">{videoData.title}</h1>
              <p className="mb-6 text-sm text-ink-400">Transcript, summary, tutor and study tools{videoData.language !== 'en' ? ', in your language' : ''}.</p>
              <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
                {authEnabled && (
                  user && videoData.analysisId ? (
                    <span className="flex items-center gap-1.5 text-aqua-400/80"><Cloud className="w-4 h-4" /> Saved to your library</span>
                  ) : !user ? (
                    <button onClick={() => setAuthOpen(true)} className="flex items-center gap-1.5 text-amber-300/80 hover:text-amber-200">
                      <CloudOff className="w-4 h-4" /> Sign in to save this video and chat
                    </button>
                  ) : null
                )}
                {notice && <span className="text-ink-500">{notice}</span>}
                <button
                  onClick={() => openLessons(true)}
                  className={`${language !== videoData.language ? '' : 'ml-auto '}flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neon-400 text-white font-medium hover:bg-neon-500`}
                >
                  <Clapperboard className="w-4 h-4" /> Make a video lesson
                </button>
                {language !== videoData.language && (
                  <button
                    onClick={() => handleSummarize(`https://youtu.be/${videoData.videoId}`, language)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neon-500/15 border border-neon-500/30 text-neon-300 hover:bg-neon-500/25"
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
                <div className="lg:col-span-2 lg:sticky lg:top-[148px] lg:self-start">
                  <AIInsights
                    summary={videoData.summary}
                    keyTakeaways={videoData.keyTakeaways}
                    onSeek={seekTo}
                    scrollable
                    level={videoData.level || 'intermediate'}
                    onLevelChange={changeSummaryLevel}
                    levelBusy={summaryBusy}
                    levelNotice={summaryNotice || videoData.levelNotice || null}
                  />
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
                  <div role="alert" className="fixed inset-x-0 top-24 z-[55] flex justify-center px-4">
                    <p className="glass max-w-xl rounded-xl border-red-500/40 p-4 text-red-200">{error}</p>
                  </div>
                )}
                <HomePage
                  busy={busy}
                  language={language}
                  onLanguageChange={setLanguage}
                  onSummarize={(url) => handleSummarize(url)}
                  onMakeLesson={makeLesson}
                  onOpenLibraryItem={openLibraryItem}
                  onOpenLessons={() => openLessons(false)}
                  onPlayLesson={playLesson}
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
