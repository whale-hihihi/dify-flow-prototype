import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

/** 页面内容淡入 + 上滑 */
export function usePageEnter() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    animate(ref.current, {
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 500,
      ease: 'out(3)',
    });
  }, []);
  return ref;
}

/** 子元素依次入场（卡片、行等） */
export function useStaggerChildren(selector: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    // Slight delay to let React render the children first
    const timer = setTimeout(() => {
      if (!ref.current) return;
      const els = ref.current.querySelectorAll(selector);
      if (els.length === 0) return;
      animate(els, {
        opacity: [0, 1],
        translateY: [24, 0],
        scale: [0.96, 1],
        delay: stagger(80, { start: 120 }),
        duration: 500,
        ease: 'out(3)',
      });
    }, 60);
    return () => clearTimeout(timer);
  }, []);
  return ref;
}
