import { useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, Menu, X, PlaySquare, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Wordmark } from './Wordmark';
import { useLearner } from '../../context/LearnerContext';
import { learnerLabel } from '../learner/LearnerChoice';
import { AppView } from '../../lib/navigation';
import { NAV_ITEMS } from './navItems';

interface HeaderProps {
  view: AppView;
  hasVideo: boolean;
  onNavigate: (view: AppView) => void;
  onGoHome: () => void;
  onOpenAuth: () => void;
}

/** A plain top bar: logo, the main pages, your learning profile and account. On phones the pages fold into a menu. */
export default function Header({ view, hasVideo, onNavigate, onGoHome, onOpenAuth }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const firstLink = useRef<HTMLButtonElement>(null);
  const { learner, openSettings } = useLearner();
  const { enabled: authEnabled, user, loading, signOut } = useAuth();
  const name = (user?.user_metadata?.full_name as string) || user?.email || '';

  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const items = [
    ...NAV_ITEMS,
    ...(hasVideo ? [{ view: 'dashboard' as AppView, label: 'Current video', icon: PlaySquare, needsAccount: false }] : []),
  ];
  const go = (v: AppView, needsAccount?: boolean) => {
    setOpen(false);
    if (needsAccount && authEnabled && !user) onOpenAuth();
    else onNavigate(v);
  };

  const account = authEnabled && !loading && (user ? (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neon-400 text-sm font-bold text-white" title={name}>
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  ) : (
    <button onClick={onOpenAuth} className="btn-outline">
      <LogIn className="h-4 w-4" /> Sign in
    </button>
  ));

  return (
    <header className="sticky top-0 z-[60] border-b border-white/[0.07] bg-ink-950/90 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Wordmark onClick={() => { setOpen(false); onGoHome(); }} />

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {items.map((n) => (
            <button
              key={n.view}
              onClick={() => go(n.view, n.needsAccount)}
              aria-current={view === n.view ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 text-[15px] font-medium transition-colors ${view === n.view ? 'bg-white/[0.06] text-white' : 'text-ink-300 hover:text-white'}`}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button onClick={openSettings} className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-sm text-ink-200 hover:border-neon-300/60 hover:text-white md:flex" title="Change how things are explained to you">
            <UserRound className="h-4 w-4 text-plasma-400" /> {learnerLabel(learner)}
          </button>
          <span className="hidden lg:block">{account}</span>
          {authEnabled && user && <button onClick={signOut} className="hidden rounded-lg p-2 text-ink-400 hover:text-white lg:block" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? 'Close menu' : 'Menu'}
            className="rounded-lg p-2 text-ink-100 hover:bg-white/5 lg:hidden"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="site-menu" role="dialog" aria-label="Menu" className="border-t border-white/[0.07] bg-ink-950 px-4 pb-5 pt-2 lg:hidden">
          <nav aria-label="Pages" className="flex flex-col">
            {items.map((n, i) => {
              const Icon = n.icon;
              return (
                <button
                  key={n.view}
                  ref={i === 0 ? firstLink : undefined}
                  onClick={() => go(n.view, n.needsAccount)}
                  aria-current={view === n.view ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left text-base font-medium ${view === n.view ? 'bg-white/[0.06] text-white' : 'text-ink-200'}`}
                >
                  <Icon className="h-5 w-5 text-neon-300" /> {n.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-3 flex flex-col gap-1 border-t border-white/[0.07] pt-3 text-sm">
            <button onClick={() => { setOpen(false); openSettings(); }} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-ink-200">
              <UserRound className="h-5 w-5 text-plasma-400" /> Learning profile: {learnerLabel(learner)}
            </button>
            {authEnabled && (user ? (
              <button onClick={() => { setOpen(false); signOut(); }} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-ink-200"><LogOut className="h-5 w-5" /> Sign out</button>
            ) : (
              <button onClick={() => { setOpen(false); onOpenAuth(); }} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-ink-200"><LogIn className="h-5 w-5" /> Sign in or create an account</button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
