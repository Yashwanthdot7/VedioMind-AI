/** The VideoMind mark: a portal ring around a V */
export function PortalMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="pm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B3A1FF" />
          <stop offset=".55" stopColor="#E040FB" />
          <stop offset="1" stopColor="#3EBDD4" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="24" fill="none" stroke="url(#pm-g)" strokeWidth="5" />
      <path d="M22 22 L32 43 L42 22" fill="none" stroke="#F1ECFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-ink-50" aria-label="VideoMind home">
      <PortalMark className={compact ? 'w-7 h-7' : 'w-8 h-8'} />
      <span className={`font-display leading-none ${compact ? 'text-2xl' : 'text-[1.9rem]'}`}>VideoMind</span>
    </button>
  );
}
