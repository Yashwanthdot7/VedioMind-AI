import { useState } from 'react';
import { Copy, Check, Download, BookOpen } from 'lucide-react';
import { StudyNotes } from '../../types';
import RichText from '../RichText';
import TimestampChip from './TimestampChip';
import { downloadText, slugify } from '../../lib/download';

interface NotesViewProps {
  notes: StudyNotes;
  videoTitle: string;
  videoId: string;
  onSeek?: (seconds: number) => void;
}

function toMarkdown(notes: StudyNotes, videoTitle: string, videoId: string): string {
  const lines = [
    `# ${notes.title || videoTitle}`,
    '',
    `> Notes for [${videoTitle}](https://www.youtube.com/watch?v=${videoId}) — made with VideoMind AI`,
    '',
    notes.overview,
    '',
  ];
  for (const section of notes.sections) {
    lines.push(`## ${section.heading}${section.timestamp ? ` (${section.timestamp})` : ''}`, '');
    for (const point of section.points) lines.push(`- ${point}`);
    lines.push('');
  }
  if (notes.keyTerms.length) {
    lines.push('## Key terms', '');
    for (const k of notes.keyTerms) lines.push(`- **${k.term}**: ${k.definition}`);
    lines.push('');
  }
  return lines.join('\n');
}

export default function NotesView({ notes, videoTitle, videoId, onSeek }: NotesViewProps) {
  const [copied, setCopied] = useState(false);
  const markdown = () => toMarkdown(notes, videoTitle, videoId);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <BookOpen className="w-5 h-5 text-neon-400 mt-0.5 shrink-0" />
        <h3 className="flex-1 text-base font-semibold text-ink-100 leading-snug">{notes.title || videoTitle}</h3>
        <button onClick={copy} className="p-2 rounded-lg bg-ink-800/50 hover:bg-ink-700/50 text-ink-400 hover:text-ink-200" title="Copy notes as Markdown" aria-label="Copy notes">
          {copied ? <Check className="w-4 h-4 text-aqua-400" /> : <Copy className="w-4 h-4" />}
        </button>
        <button
          onClick={() => downloadText(`${slugify(videoTitle)}-notes.md`, markdown(), 'text/markdown')}
          className="p-2 rounded-lg bg-ink-800/50 hover:bg-ink-700/50 text-ink-400 hover:text-ink-200"
          title="Download notes (.md)"
          aria-label="Download notes"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {notes.overview && <p className="text-sm text-ink-300 leading-relaxed max-w-4xl">{notes.overview}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {notes.sections.map((section, i) => (
          <section key={i} className="p-4 rounded-xl bg-ink-950/40 border border-ink-800/60">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h4 className="text-sm font-semibold text-neon-300">
                <span className="text-ink-500 mr-1.5">{i + 1}.</span>{section.heading}
              </h4>
              <TimestampChip timestamp={section.timestamp} onSeek={onSeek} />
            </div>
            <RichText text={section.points.map((p) => `- ${p}`).join('\n')} onSeek={onSeek} className="text-sm text-ink-300" />
          </section>
        ))}
      </div>

      {notes.keyTerms.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-amber-400 mb-3">Key terms</h4>
          <dl className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {notes.keyTerms.map((k, i) => (
              <div key={i} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <dt className="text-sm font-semibold text-amber-200">{k.term}</dt>
                <dd className="text-sm text-ink-300 mt-0.5 leading-relaxed">{k.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
