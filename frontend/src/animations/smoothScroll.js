import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Single-loop smooth scrolling.
 *
 * GSAP's ticker is the only requestAnimationFrame loop in the app: it advances
 * Lenis, and Lenis then notifies ScrollTrigger. That ordering matters - two
 * independent rAF loops fighting over scroll position is the classic source of
 * jitter, and it is deliberately avoided here.
 *
 * When the visitor prefers reduced motion nothing is instantiated: native
 * scrolling is used and every consumer falls back to static presentation.
 */

let lenis = null;
let tickerCallback = null;
let scrollTriggerHandler = null;

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function initSmoothScroll() {
  if (typeof window === 'undefined' || prefersReducedMotion() || lenis) return lenis;

  lenis = new Lenis({
    duration: 1.05,
    smoothWheel: true,
    // Touch devices already have momentum scrolling; adding ours fights the OS.
    syncTouch: false,
    touchMultiplier: 1.4,
    wheelMultiplier: 1,
    lerp: 0.11,
    autoRaf: false,
    prevent: (node) => node.closest('[role="dialog"]') !== null,
  });

  tickerCallback = (time) => lenis?.raf(time * 1000);
  gsap.ticker.add(tickerCallback);
  gsap.ticker.lagSmoothing(500, 33);

  scrollTriggerHandler = () => ScrollTrigger.update();
  lenis.on('scroll', scrollTriggerHandler);

  return lenis;
}

export function getLenis() {
  return lenis;
}

export function destroySmoothScroll() {
  if (!lenis) return;
  if (tickerCallback) gsap.ticker.remove(tickerCallback);
  if (scrollTriggerHandler) lenis.off('scroll', scrollTriggerHandler);
  lenis.destroy();
  lenis = null;
  tickerCallback = null;
  scrollTriggerHandler = null;
}

/** Stops/starts scrolling - used while a modal or mobile drawer is open. */
export function setScrollLocked(locked) {
  if (!lenis) {
    document.body.style.overflow = locked ? 'hidden' : '';
    return;
  }
  if (locked) lenis.stop();
  else lenis.start();
}

/** Programmatic navigation that works with or without Lenis. */
export function scrollToTarget(target, options = {}) {
  const element =
    typeof target === 'string' ? document.querySelector(target) : target;
  if (!element) return;

  const offset = options.offset ?? -76;
  if (lenis && !prefersReducedMotion()) {
    lenis.scrollTo(element, { offset, duration: options.duration ?? 1.1 });
    return;
  }
  const top = element.getBoundingClientRect().top + window.scrollY + offset;
  window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

export function scrollToTop(immediate = true) {
  if (lenis && !prefersReducedMotion() && !immediate) {
    lenis.scrollTo(0, { duration: 0.8 });
    return;
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
}

export { gsap, ScrollTrigger };
