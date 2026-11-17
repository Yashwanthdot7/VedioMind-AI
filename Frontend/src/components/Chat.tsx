import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Bot, User, Maximize2, X, Sparkles, Video, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '../types';
import RichText from './RichText';

interface ChatProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  videoTitle?: string;
  isTyping?: boolean;
  onSeek?: (seconds: number) => void;
  onClear?: () => void;
}

const SUGGESTIONS = [
  'Explain this video like I\'m 10 years old',
  'What are the most important points?',
  'Make 5 quiz questions from this video',
];

export default function Chat({ messages, onSendMessage, videoTitle, isTyping = false, onSeek, onClear }: ChatProps) {
  const [input, setInput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Disable body scroll when fullscreen
  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  // Show transition when entering fullscreen
  useEffect(() => {
    if (isFullscreen) {
      setShowTransition(true);
      const timer = setTimeout(() => setShowTransition(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isTyping) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  // Leaving fullscreen should land the user back on the video when they click a timestamp
  const handleSeek = onSeek
    ? (seconds: number) => {
        setIsFullscreen(false);
        onSeek(seconds);
      }
    : undefined;

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Normal embedded view
  const ChatContent = (
    <div className={`${isFullscreen
        ? 'fixed inset-0 z-[9999] flex flex-col'
        : 'rounded-2xl overflow-hidden backdrop-blur-sm flex flex-col h-[500px]'
      } ${isFullscreen
        ? 'bg-gradient-to-br from-[#0A0A1F] via-[#0F123D] to-[#1E293B]'
        : 'bg-slate-900/50 border border-slate-800/50'
      }`}>
      {/* Header */}
      <div className={`${isFullscreen
          ? 'px-6 py-4 bg-black/40 backdrop-blur-lg border-b border-indigo-500/30'
          : 'p-4 border-b border-slate-800/50'
        } flex-shrink-0 relative z-10`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isFullscreen ? (
              <Video className="w-6 h-6 text-indigo-400" />
            ) : (
              <MessageCircle className="w-5 h-5 text-indigo-400" />
            )}
            <div>
              <h2 className={`${isFullscreen ? 'text-xl' : 'text-lg'
                } font-semibold text-slate-200`}>
                {isFullscreen ? 'VideoMind AI Chat' : 'Chat with Video'}
              </h2>
              {isFullscreen && videoTitle && (
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                  About: {videoTitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
          {onClear && messages.length > 1 && (
            <button
              onClick={onClear}
              className={`p-2 rounded-full ${isFullscreen ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-800/50 hover:bg-slate-700/50'} transition-all`}
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <Trash2 className="w-4 h-4 text-slate-400" />
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className={`p-2 rounded-full ${isFullscreen
                ? 'bg-white/5 hover:bg-white/10'
                : 'bg-slate-800/50 hover:bg-slate-700/50'
              } transition-all`}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <X className="w-5 h-5 text-gray-300" />
            ) : (
              <Maximize2 className="w-4 h-4 text-slate-400" />
            )}
          </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto ${isFullscreen ? 'px-6 py-6' : 'p-6'
        } space-y-4 custom-scrollbar relative z-10`}>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
          >
            {message.role === 'assistant' && (
              <div className={`flex-shrink-0 ${isFullscreen ? 'w-10 h-10' : 'w-8 h-8'
                } rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20`}>
                <Bot className={`${isFullscreen ? 'w-5 h-5' : 'w-4 h-4'} text-white`} />
              </div>
            )}

            <div
              className={`${isFullscreen ? 'max-w-[70%]' : 'max-w-[80%]'
                } rounded-2xl px-4 py-3 ${message.role === 'user'
                  ? isFullscreen
                    ? 'bg-cyan-500/20 border border-cyan-400/30'
                    : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : isFullscreen
                    ? 'bg-white/10 border border-indigo-400/30'
                    : 'bg-slate-800/50 text-slate-200 border border-slate-700/50'
                }`}
            >
              {message.role === 'assistant' ? (
                <RichText text={message.content} onSeek={handleSeek} className="text-sm" />
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
              )}
            </div>

            {message.role === 'user' && (
              <div className={`flex-shrink-0 ${isFullscreen ? 'w-10 h-10' : 'w-8 h-8'
                } rounded-lg ${isFullscreen ? 'bg-cyan-500/20' : 'bg-slate-700'
                } flex items-center justify-center`}>
                <User className={`${isFullscreen ? 'w-5 h-5' : 'w-4 h-4'} ${isFullscreen ? 'text-cyan-300' : 'text-slate-300'
                  }`} />
              </div>
            )}
          </motion.div>
        ))}

        {messages.length <= 1 && !isTyping && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => onSendMessage(q)}
                className="px-3 py-1.5 text-xs rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-indigo-400 text-sm"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>VideoMind AI is thinking...</span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`${isFullscreen
          ? 'px-6 py-4 bg-black/50 border-t border-indigo-500/30'
          : 'p-4 border-t border-slate-800/50 bg-slate-950/50'
        } flex-shrink-0 relative z-20`}>
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isFullscreen ? "Ask VideoMind AI anything about this video..." : "Ask anything about the video..."}
            className={`flex-1 px-5 py-3 rounded-full ${isFullscreen
                ? 'bg-white/10 border border-indigo-400/30 text-white placeholder-slate-400'
                : 'bg-slate-900/50 border border-slate-700/50 text-slate-200 placeholder-slate-500'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all`}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className={`${isFullscreen
                ? 'p-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600'
                : 'px-6 py-3 bg-indigo-600 hover:bg-indigo-500'
              } disabled:bg-slate-700 disabled:cursor-not-allowed rounded-full text-white font-medium transition-all shadow-lg ${isFullscreen ? 'shadow-indigo-600/30' : 'shadow-indigo-600/20'
              } hover:shadow-indigo-500/30 flex items-center gap-2`}
          >
            <Send className="w-4 h-4" />
            {!isFullscreen && <span className="hidden sm:inline">Send</span>}
          </button>
        </form>
      </div>

      {/* Background blur overlay for fullscreen */}
      {isFullscreen && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md pointer-events-none" />
      )}
    </div>
  );

  if (!isFullscreen) {
    return ChatContent;
  }

  return (
    <AnimatePresence mode="wait">
      {showTransition ? (
        <motion.div
          key="transition"
          className="fixed inset-0 flex items-center justify-center bg-black text-white z-[10000]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Sparkles className="w-16 h-16 text-indigo-400 animate-spin" />
        </motion.div>
      ) : (
        <motion.div
          key="fullscreen-chat"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {ChatContent}
        </motion.div>
      )}
    </AnimatePresence>
  );

}