import { useAuth } from '../../context/AuthContext';
import { AppView } from '../../lib/navigation';
import { NAV_ITEMS } from './navItems';

interface MobileNavProps {
  view: AppView;
  onNavigate: (view: AppView) => void;
  onOpenAuth: () => void;
}

/** Bottom tab bar on phones and tablets (the sidebar takes over from lg up) */
export default function MobileNav({ view, onNavigate, onOpenAuth }: MobileNavProps) {
  const { enabled: authEnabled, user } = useAuth();
  return (
    <nav
      aria-label="Main"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-4 border-t border-ink-800 bg-ink-950/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      {NAV_ITEMS.map((n) => {
        const active = view === n.view;
        return (
          <button
            key={n.view}
            onClick={() => (n.needsAccount && authEnabled && !user ? onOpenAuth() : onNavigate(n.view))}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active ? 'text-turmeric-400' : 'text-ink-400'}`}
          >
            <n.icon className="w-5 h-5" />
            {n.label}
          </button>
        );
      })}
    </nav>
  );
}
