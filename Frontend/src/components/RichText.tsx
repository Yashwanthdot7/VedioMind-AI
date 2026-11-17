import { Fragment, ReactNode } from 'react';
import { parseTimestamp } from '../lib/time';

/**
 * Lightweight Markdown renderer for AI output:
 * paragraphs, "- " / "* " / "1. " lists, **bold**, *italic*, `code`, and
 * clickable [m:ss] timestamps that seek the video.
 */

interface RichTextProps {
  text: string;
  onSeek?: (seconds: number) => void;
  className?: string;
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[\d{1,2}(?::\d{2}){1,2}\])/g;

function renderInline(text: string, onSeek?: (s: number) => void, keyPrefix = ''): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key} className="font-semibold text-indigo-300">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key} className="px-1 py-0.5 rounded bg-slate-800 text-pink-300 text-[0.9em]">{part.slice(1, -1)}</code>;
    }
    const ts = part.match(/^\[(\d{1,2}(?::\d{2}){1,2})\]$/);
    if (ts) {
      const seconds = parseTimestamp(ts[1]);
      if (seconds !== null && onSeek) {
        return (
          <button
            key={key}
            onClick={() => onSeek(seconds)}
            className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono text-[0.85em] hover:bg-indigo-500/30 transition-colors"
            title={`Jump to ${ts[1]}`}
          >
            {ts[1]}
          </button>
        );
      }
      return <span key={key} className="font-mono text-indigo-300">{ts[1]}</span>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key} className="italic">{part.slice(1, -1)}</em>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export default function RichText({ text, onSeek, className = '' }: RichTextProps) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      const k = `p${blocks.length}`;
      blocks.push(<p key={k} className="leading-relaxed">{renderInline(paragraph.join(' '), onSeek, k)}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const k = `l${blocks.length}`;
      const items = list.items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 leading-relaxed">
          <span className="text-indigo-400 select-none mt-0.5">{list!.ordered ? `${i + 1}.` : '•'}</span>
          <span className="flex-1">{renderInline(item, onSeek, `${k}-${i}`)}</span>
        </li>
      ));
      blocks.push(<ul key={k} className="space-y-1.5 ml-1">{items}</ul>);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,6}\s+(.*)$/);

    if (!line) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const k = `h${blocks.length}`;
      blocks.push(<p key={k} className="font-semibold text-slate-100">{renderInline(heading[1], onSeek, k)}</p>);
    } else if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet || numbered)![1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();

  return <div className={`space-y-3 ${className}`}>{blocks}</div>;
}
