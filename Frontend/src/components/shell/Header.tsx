import { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Wordmark } from './Wordmark';
import { useLearner } from '../../context/LearnerContext';
import { learnerLabel } from '../learner/LearnerChoice';

/** Three converging strokes: our menu glyph */
function MenuGlyph({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 28 16" className="h-4 w-7" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      {open ? (
        <>
          <path d="M6 2 L22 14" />
          <path d="M22 2 L6 14" />
        </>
      ) : (
        <>
          <path d="M2 2 L14 8 L26 2" />
          <path d="M2 8 H26" />
          <path d="M2 14 L14 8 L26 14" />
        </>
      )}
    </svg>
  );
}

interface HeaderProps {
  menuOpen: boolean;
  onToggleMenu: () => void;
  onGoHome: () => void;
  onOpenAuth: () => void;
  onCreate: () => void;
  /** Over the home hero the frame floats on the art until the page scrolls */
  overArt?: boolean;
}

/**
 * Fixed frame across the top: a thin rule with a notch that holds the wordmark,
 * MENU on the left, a quick action and the account on the right.
 */
export default function Header({ menuOpen, onToggleMenu, onGoHome, onOpenAuth, onCreate, overArt = false }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const solid = !overArt || scrolled || menuOpen;
  const { learner, openSettings } = useLearner();

  const { enabled: authEnabled, user, loading } = useAuth();
  const name = (user?.user_metadata?.full_name as string) || user?.email || '';
  const avatar = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <header className="fixed inset-x-0 top-0 z-[60] px-3 pt-3 sm:px-6">
      <div className={`absolute inset-x-0 top-0 h-[76px] border-b transition-colors duration-300 ${solid ? 'border-white/10 bg-ink-950/85 backdrop-blur-xl' : 'border-transparent bg-transparent'}`} aria-hidden="true" />
      {/* the frame */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex h-[64px] sm:inset-x-6" aria-hidden="true">
        <div className="mt-[2px] h-px flex-1 bg-gradient-to-r from-transparent via-white/25 to-white/25" />
        <svg viewBox="0 0 260 64" className="h-[64px] w-[220px] shrink-0 sm:w-[260px]" preserveAspectRatio="none" fill="none">
          <path d="M0 2.5 H22 L46 40 H214 L238 2.5 H260" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
          <path d="M14 10 L32 38" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <path d="M246 10 L228 38" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        </svg>
        <div className="mt-[2px] h-px flex-1 bg-gradient-to-l from-transparent via-white/25 to-white/25" />
      </div>

      <div className="relative flex h-[56px] items-center gap-3 px-2 sm:px-4">
        <button
          onClick={onToggleMenu}
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          aria-label={menuOpen ? 'Close menu' : 'Menu'}
          className="flex items-center gap-3 rounded-md px-2 py-2 text-ink-100 transition-opacity hover:opacity-70"
        >
          <MenuGlyph open={menuOpen} />
          <span className="hidden text-sm font-medium tracking-[0.18em] sm:inline">{menuOpen ? 'CLOSE' : 'MENU'}</span>
        </button>

        <div className="absolute left-1/2 top-[2px] -translate-x-1/2">
          <Wordmark onClick={onGoHome} compact />
        </div>

        <div className="ml-auto flex items-center gap-4">
          <button onClick={openSettings} className="hidden text-sm font-medium uppercase tracking-[0.14em] text-neon-200 transition-opacity hover:opacity-70 lg:inline" title="Change how things are explained to you">
            {learnerLabel(learner)}
          </button>
          <button onClick={onCreate} className="hidden text-sm font-medium tracking-[0.14em] text-ink-100 transition-opacity hover:opacity-70 md:inline">
            MAKE A LESSON
          </button>
          {authEnabled && !loading && (user ? (
            <span className="flex items-center gap-2" title={name}>
              {avatar ? (
                <img src={avatar} alt="" className="h-8 w-8 rounded-full ring-1 ring-neon-300/60" referrerPolicy="no-referrer" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neon-400 text-sm font-bold text-white">
                  {(name || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </span>
          ) : (
            <button onClick={onOpenAuth} className="btn-outline">
              <LogIn className="h-4 w-4 sm:hidden" /> <span className="hidden sm:inline">Login</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
