import { prefersReducedMotion } from './smoothScroll.js';

/**
 * Scroll reveals.
 *
 * IntersectionObserver rather than ScrollTrigger for element-level entrances:
 * reveals are cheap, one-shot and never need to track scroll position, so they
 * must not add work to the animation loop that already drives Lenis.
 */

const REVEAL_CLASS = 'reveal';
const VISIBLE_CLASS = 'reveal-in';

let observer = null;

function ensureObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        const delay = Number(element.dataset.revealDelay || 0);
        window.setTimeout(() => {
          element.classList.add(VISIBLE_CLASS);
          element.dispatchEvent(new CustomEvent('driveease:revealed', { bubbles: true }));
        }, delay);
        observer.unobserve(element);
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
  );
  return observer;
}

/** Marks every `[data-reveal]` inside `scope` and starts observing it. */
export function observeReveals(scope = document) {
  if (prefersReducedMotion()) {
    scope.querySelectorAll(`[data-reveal]`).forEach((element) => {
      element.classList.add(REVEAL_CLASS, VISIBLE_CLASS);
    });
    return () => {};
  }

  const instance = ensureObserver();
  const targets = Array.from(scope.querySelectorAll('[data-reveal]'));
  targets.forEach((element) => {
    element.classList.add(REVEAL_CLASS);
    instance.observe(element);
  });

  return () => {
    targets.forEach((element) => instance.unobserve(element));
  };
}

export function disconnectReveals() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

/** Simple count-up used by the statistics strip (skipped when motion is reduced). */
export function animateCount(element, to, { duration = 1200, decimals = 0, suffix = '' } = {}) {
  if (!element) return () => {};
  const target = Number(to) || 0;
  if (prefersReducedMotion()) {
    element.textContent = `${target.toFixed(decimals)}${suffix}`;
    return () => {};
  }

  const start = performance.now();
  let frame = 0;

  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    // easeOutCubic keeps the tail of the animation calm.
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = `${(target * eased).toFixed(decimals)}${suffix}`;
    if (progress < 1) frame = requestAnimationFrame(step);
  };

  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}
