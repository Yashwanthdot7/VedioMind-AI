import { KeyboardEvent, useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, Shuffle, Download, Check, RotateCcw } from 'lucide-react';
import { StudyFlashcards } from '../../types';
import TimestampChip from './TimestampChip';
import { csvCell, downloadText, slugify } from '../../lib/download';

interface FlashcardsViewProps {
  deck: StudyFlashcards;
  videoTitle: string;
  onSeek?: (seconds: number) => void;
}

const shuffled = (n: number) => {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
};

export default function FlashcardsView({ deck, videoTitle, onSeek }: FlashcardsViewProps) {
  const total = deck.cards.length;
  const [order, setOrder] = useState(() => deck.cards.map((_, i) => i));
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(() => new Set());

  const card = deck.cards[order[position]];

  const go = useCallback((delta: number) => {
    setFlipped(false);
    setPosition((p) => (p + delta + total) % total);
  }, [total]);

  const markKnown = () => {
    setKnown((prev) => new Set(prev).add(order[position]));
    go(1);
  };

  // Keyboard (only while focus is inside the flashcards): ← → to move
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  };

  const exportCsv = () => {
    // Anki: File → Import → choose this file (comma separated, 2 fields)
    const rows = deck.cards.map((c) => `${csvCell(c.front)},${csvCell(c.back)}`);
    downloadText(`${slugify(videoTitle)}-flashcards.csv`, `${rows.join('\n')}\n`, 'text/csv');
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto" onKeyDown={onKeyDown}>
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>Card {position + 1} of {total} · <span className="text-emerald-400">{known.size} known</span></span>
        <div className="flex gap-1">
          <button onClick={() => { setOrder(shuffled(total)); setPosition(0); setFlipped(false); }} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400" title="Shuffle" aria-label="Shuffle cards">
            <Shuffle className="w-4 h-4" />
          </button>
          <button onClick={() => { setKnown(new Set()); setPosition(0); setFlipped(false); }} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400" title="Start over" aria-label="Start over">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={exportCsv} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400" title="Download for Anki / Quizlet (.csv)" aria-label="Download flashcards">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div style={{ perspective: '1200px' }}>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? 'Show question' : 'Show answer'}
          className="relative w-full h-56 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-2xl"
          style={{ transformStyle: 'preserve-3d', transition: 'transform 0.5s', transform: flipped ? 'rotateY(180deg)' : 'none' }}
        >
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/15 to-purple-500/10"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="absolute top-3 left-4 text-[10px] uppercase tracking-wider text-indigo-300/70">Question</span>
            <p className="text-lg font-medium text-slate-100 text-center leading-snug">{card.front}</p>
            <span className="absolute bottom-3 text-[11px] text-slate-500">Tap to flip</span>
          </div>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/10"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <span className="absolute top-3 left-4 text-[10px] uppercase tracking-wider text-emerald-300/70">Answer</span>
            <p className="text-base text-slate-100 text-center leading-relaxed">{card.back}</p>
            {known.has(order[position]) && <Check className="absolute top-3 right-4 w-4 h-4 text-emerald-400" />}
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => go(-1)} className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-300" aria-label="Previous card">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex justify-center">
          <TimestampChip timestamp={card.timestamp} onSeek={onSeek} label="Watch" />
        </div>
        {flipped && (
          <button onClick={markKnown} className="px-3 py-2 text-sm rounded-xl bg-emerald-600/80 hover:bg-emerald-500 text-white">
            I knew it
          </button>
        )}
        <button onClick={() => go(1)} className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-300" aria-label="Next card">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <p className="text-[11px] text-slate-600 text-center">Click the card (or press Space) to flip · ← → to move</p>
    </div>
  );
}
