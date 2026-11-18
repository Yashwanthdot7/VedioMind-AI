import { useEffect, useRef, useState } from 'react';

/** True once the element has scrolled into view (immediately when motion is reduced or unsupported) */
export function useReveal<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(() =>
    typeof window === 'undefined' || !('IntersectionObserver' in window) || Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
  useEffect(() => {
    if (shown || !ref.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [shown, threshold]);
  return { ref, shown };
}
