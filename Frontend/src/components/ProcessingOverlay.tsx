import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { ProcessingStep } from '../types';

interface ProcessingOverlayProps {
  isVisible: boolean;
  steps: ProcessingStep[];
  progress: number;
}

export default function ProcessingOverlay({ isVisible, steps, progress }: ProcessingOverlayProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="bg-ink-900 border border-ink-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-turmeric-400 text-ink-950">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-ink-200 mb-2">Reading the video</h2>
              <p className="text-ink-400">
                Analyzing content and generating insights...
              </p>
            </div>

            <div className="mb-6">
              <div className="h-2 bg-ink-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full rounded-full bg-turmeric-400 text-ink-950"
                />
              </div>
              <div className="text-right mt-2">
                <span className="text-sm font-medium text-turmeric-400">{progress}%</span>
              </div>
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                    step.completed
                      ? 'bg-lagoon-500/10 border border-lagoon-500/20'
                      : 'bg-ink-800/30 border border-ink-700/30'
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-lagoon-400 flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-ink-600 flex-shrink-0" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      step.completed ? 'text-lagoon-400' : 'text-ink-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}