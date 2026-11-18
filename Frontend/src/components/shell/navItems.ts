import { Home, Library, Clapperboard, BarChart3 } from 'lucide-react';
import { AppView } from '../../lib/navigation';

export interface NavItem {
  view: AppView;
  label: string;
  icon: typeof Home;
  needsAccount?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { view: 'home', label: 'Home', icon: Home },
  { view: 'library', label: 'Library', icon: Library, needsAccount: true },
  { view: 'lessons', label: 'Video lessons', icon: Clapperboard },
  { view: 'analytics', label: 'Progress', icon: BarChart3 },
];
