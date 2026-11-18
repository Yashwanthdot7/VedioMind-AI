/** Tiny app-wide navigation event, so deep components can open a page without prop drilling */
export type AppView = 'home' | 'dashboard' | 'library' | 'lessons' | 'analytics' | 'shared';

const EVENT = 'videomind:navigate';

export function navigate(view: AppView) {
  window.dispatchEvent(new CustomEvent<AppView>(EVENT, { detail: view }));
}

export function onNavigate(handler: (view: AppView) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<AppView>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
