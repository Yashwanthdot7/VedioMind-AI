/** The VideoMind mark: a play button inside an open book */
export function BrandMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#8A4FD6" />
      <path d="M7 10.5c3-1.4 6-1.4 9 0v12c-3-1.4-6-1.4-9 0zM25 10.5c-3-1.4-6-1.4-9 0v12c3-1.4 6-1.4 9 0z" fill="none" stroke="#F2F0F6" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14.2 13.6v5.2l4.3-2.6z" fill="#00E5FF" />
    </svg>
  );
}

export function Wordmark({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 text-ink-50" aria-label="VideoMind home">
      <BrandMark className="h-8 w-8" />
      <span className="text-xl font-bold tracking-tight">VideoMind</span>
    </button>
  );
}
