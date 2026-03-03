import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from './components/Header';
import VideoPlayer from './components/VideoPlayer';
import Transcript from './components/Transcript';
import AIInsights from './components/AIInsights';
import Chat from './components/Chat';
import ProcessingOverlay from './components/ProcessingOverlay';
import { ProcessingStatus, VideoData, Message, ProcessingStep } from './types';
import { processVideo, askQuestion } from './services/apiService';

function App() {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showDashboard, setShowDashboard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { label: 'Fetching Video', completed: false },
    { label: 'Transcribing Audio', completed: false },
    { label: 'Analyzing Content', completed: false },
  ]);
  const [progress, setProgress] = useState(0);

  const handleSummarize = async (url: string) => {
    setStatus(ProcessingStatus.LOADING);
    setShowDashboard(false);
    setError(null);
    setProgress(0);
    setProcessingSteps([
      { label: 'Fetching Video', completed: false },
      { label: 'Transcribing Audio', completed: false },
      { label: 'Analyzing Content', completed: false },
    ]);

    try {
      // Step 1: Fetching video
      setProgress(10);
      await new Promise((resolve) => setTimeout(resolve, 500));

      setProcessingSteps((prev) => [
        { ...prev[0], completed: true },
        prev[1],
        prev[2],
      ]);
      setProgress(33);

      // Step 2: Get transcript
      await new Promise((resolve) => setTimeout(resolve, 300));
      setProcessingSteps((prev) => [
        prev[0],
        { ...prev[1], completed: true },
        prev[2],
      ]);
      setProgress(66);

      // Step 3: Process with AI (this is the actual API call)
      const data = await processVideo(url);

      setProcessingSteps((prev) => [
        prev[0],
        prev[1],
        { ...prev[2], completed: true },
      ]);
      setProgress(100);

      await new Promise((resolve) => setTimeout(resolve, 500));

      setVideoData(data);
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: "Hello! I've analyzed this video. Feel free to ask me anything about the content.",
          timestamp: new Date(),
        },
      ]);
      setStatus(ProcessingStatus.SUCCESS);
      setShowDashboard(true);
    } catch (err: any) {
      console.error('Error processing video:', err);
      setError(err.message || 'Failed to process video. Please try again.');
      setStatus(ProcessingStatus.ERROR);
      setProgress(0);
      setProcessingSteps([
        { label: 'Fetching Video', completed: false },
        { label: 'Transcribing Audio', completed: false },
        { label: 'Analyzing Content', completed: false },
      ]);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!videoData) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      // Prepare video context for the API
      const videoContext = {
        title: videoData.title,
        summary: videoData.summary,
        transcript: videoData.transcript,
      };

      // Get answer from AI
      const answer = await askQuestion(content, videoContext);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Error getting answer:', err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Header onSummarize={handleSummarize} status={status} />

      <ProcessingOverlay
        isVisible={status === ProcessingStatus.LOADING}
        steps={processingSteps}
        progress={progress}
      />

      <AnimatePresence mode="wait">
        {!showDashboard ? (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pt-32 pb-16 px-4"
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
                  Paste any YouTube URL above to get AI-powered summaries, transcripts, and interactive Q&A.
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
                  { icon: '📝', title: 'Smart Transcripts', desc: 'Time-stamped, searchable content' },
                  { icon: '🧠', title: 'AI Insights', desc: 'Key takeaways & summaries' },
                  { icon: '💬', title: 'Interactive Chat', desc: 'Ask questions about the video' },
                ].map((feature, index) => (
                  <div
                    key={index}
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
        ) : videoData ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="pt-24 pb-16 px-4"
          >
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 space-y-6">
                  <VideoPlayer videoId={videoData.videoId} title={videoData.title} />
                  <Transcript segments={videoData.transcript} />
                  {/* Chat below Smart Transcript */}
                  <Chat
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    videoTitle={videoData.title}
                  />
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <AIInsights
                    summary={videoData.summary}
                    keyTakeaways={videoData.keyTakeaways}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default App;