import { PlaySquare, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AppView } from '../../lib/navigation';
import { NAV_ITEMS } from './navItems';

/** The lamp mark: a V lit from above */
export function LampMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M18 20 L32 48 L46 20" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="12" r="5" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 text-turmeric-400" aria-label="VideoMind home">
      <LampMark />
      <span className="font-wide font-extrabold text-xl tracking-tight text-ink-50">VideoMind</span>
    </button>
  );
}

interface SidebarProps {
  view: AppView;
  hasVideo: boolean;
  videoTitle?: string;
  onNavigate: (view: AppView) => void;
  onOpenAuth: () => void;
}

export default function Sidebar({ view, hasVideo, videoTitle, onNavigate, onOpenAuth }: SidebarProps) {
  const { enabled: authEnabled, user, loading, signOut } = useAuth();
  const name = (user?.user_metadata?.full_name as string) || user?.email || '';
  const avatar = user?.user_metadata?.avatar_url as string | undefined;

  const item = (active: boolean) => `group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[15px] transition-colors ${
    active ? 'bg-ink-800/80 text-ink-50' : 'text-ink-400 hover:text-ink-100 hover:bg-ink-900'
  }`;

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-ink-800/70 bg-ink-950 px-4 py-6">
      <div className="px-2 mb-8">
        <Wordmark onClick={() => onNavigate('home')} />
      </div>

      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV_ITEMS.map((n) => {
          const active = view === n.view;
          return (
            <button
              key={n.view}
              onClick={() => (n.needsAccount && authEnabled && !user ? onOpenAuth() : onNavigate(n.view))}
              className={item(active)}
              aria-current={active ? 'page' : undefined}
            >
              {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-turmeric-400" aria-hidden="true" />}
              <n.icon className={`w-5 h-5 ${active ? 'text-turmeric-400' : ''}`} />
              {n.label}
            </button>
          );
        })}

        {hasVideo && (
          <>
            <p className="mt-6 mb-1 px-3 text-xs text-ink-500">Open now</p>
            <button onClick={() => onNavigate('dashboard')} className={item(view === 'dashboard')} aria-current={view === 'dashboard' ? 'page' : undefined}>
              {view === 'dashboard' && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-turmeric-400" aria-hidden="true" />}
              <PlaySquare className={`w-5 h-5 shrink-0 ${view === 'dashboard' ? 'text-turmeric-400' : ''}`} />
              <span className="truncate text-left">{videoTitle || 'Current video'}</span>
            </button>
          </>
        )}
      </nav>

      <div className="mt-auto pt-6 border-t border-ink-800/70">
        {authEnabled && !loading && (
          user ? (
            <div className="flex items-center gap-3 px-2">
              {avatar ? (
                <img src={avatar} alt="" className="w-9 h-9 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-turmeric-400 text-ink-950 flex items-center justify-center font-bold">
                  {(name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-100 truncate">{name}</p>
                <button onClick={() => signOut()} className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-200">
                  <LogOut className="w-3 h-3" /> Sign out
                </button>
              </div>
            </div>
          ) : (
            <button onClick={onOpenAuth} className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl border border-ink-700 text-ink-100 hover:border-turmeric-400/60 hover:text-turmeric-200 transition-colors">
              <LogIn className="w-4 h-4" /> Sign in
            </button>
          )
        )}
        <p className="mt-4 px-2 text-xs leading-relaxed text-ink-500">Free to use. Summaries, study tools and video lessons in 15 languages.</p>
      </div>
    </aside>
  );
}
