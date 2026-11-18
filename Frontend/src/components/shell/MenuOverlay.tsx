import { useEffect, useRef } from 'react';
import { BookOpenCheck, LogIn, LogOut, PlaySquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AppView } from '../../lib/navigation';
import { NAV_ITEMS } from './navItems';
import WorldTile from '../art/WorldTile';

interface MenuOverlayProps {
  open: boolean;
  view: AppView;
  hasVideo: boolean;
  videoTitle?: string;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onOpenAuth: () => void;
}

/** Full-screen menu: big condensed links on the left, account links in the middle, art on the right */
export default function MenuOverlay({ open, view, hasVideo, videoTitle, onClose, onNavigate, onOpenAuth }: MenuOverlayProps) {
  const { enabled: authEnabled, user, signOut } = useAuth();
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const go = (v: AppView, needsAccount?: boolean) => {
    onClose();
    if (needsAccount && authEnabled && !user) onOpenAuth();
    else onNavigate(v);
  };

  const items = [
    ...NAV_ITEMS,
    ...(hasVideo ? [{ view: 'dashboard' as AppView, label: videoTitle ? 'Open video' : 'Current video', icon: PlaySquare }] : []),
  ];

  return (
    <div id="site-menu" role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 bg-ink-950/95 backdrop-blur-sm">
      <div className="mx-3 mt-[76px] grid h-[calc(100dvh-92px)] grid-cols-1 overflow-hidden border border-white/10 bg-gradient-to-br from-[#140A2E] via-ink-950 to-ink-950 sm:mx-6 lg:grid-cols-[1.2fr_0.8fr_1fr]">
        <nav aria-label="Main" className="flex flex-col justify-center gap-1 px-6 py-8 sm:pl-24 sm:pr-12">
          {items.map((n, i) => {
            const active = view === n.view;
            return (
              <button
                key={n.view}
                ref={i === 0 ? first : undefined}
                onClick={() => go(n.view, 'needsAccount' in n ? n.needsAccount : false)}
                aria-current={active ? 'page' : undefined}
                className="group relative flex items-center gap-4 py-1 text-left animate-menu-in"
                style={{ animationDelay: `${60 + i * 50}ms` }}
              >
                <span className={`absolute -left-16 hidden items-center gap-0 sm:flex ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'} transition-opacity`} aria-hidden="true">
                  <span className="h-2.5 w-2.5 rotate-45 border border-white bg-white" />
                  <span className="h-px w-10 bg-gradient-to-r from-white to-transparent" />
                </span>
                <span className={`font-display text-5xl sm:text-6xl transition-colors ${active ? 'text-neon-300' : 'text-ink-50 group-hover:text-neon-200'}`}>
                  {n.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex flex-col justify-end gap-3 border-t border-white/10 px-6 pb-10 pt-6 text-sm tracking-[0.14em] sm:px-12 lg:border-l lg:border-t-0 lg:items-end lg:pb-16">
          {authEnabled && (user ? (
            <button onClick={() => { onClose(); signOut(); }} className="flex items-center gap-2 text-ink-200 hover:text-white">
              <LogOut className="h-4 w-4" /> SIGN OUT
            </button>
          ) : (
            <button onClick={() => { onClose(); onOpenAuth(); }} className="flex items-center gap-2 text-ink-200 hover:text-white">
              <LogIn className="h-4 w-4" /> SIGN IN OR CREATE AN ACCOUNT
            </button>
          ))}
          <a href="https://github.com/Yashwanthdot7/VedioMind-AI" target="_blank" rel="noreferrer" className="text-ink-300 hover:text-white">SOURCE CODE</a>
          <span className="text-ink-500">FREE · 15 LANGUAGES</span>
        </div>

        <div className="relative hidden lg:block">
          <WorldTile theme={{ from: '#7650FF', to: '#E040FB', icon: BookOpenCheck, seed: 11 }} className="absolute inset-0 h-full w-full" iconSize={84} />
          <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-ink-950 to-transparent">
            <p className="font-display text-3xl text-ink-50">Videos in.<br />Understanding out.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
