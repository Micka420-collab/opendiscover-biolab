'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe `prefers-reduced-motion` reader. Every rAF loop in AURORA gates on this
 * to collapse to a single static frame for users who ask for reduced motion.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}
