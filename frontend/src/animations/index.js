/**
 * Animation barrel.
 *
 * Importing from here keeps the GSAP/Lenis wiring in one place and means a
 * component never has to know which library provides which behaviour.
 */
export {
  destroySmoothScroll,
  getLenis,
  gsap,
  initSmoothScroll,
  prefersReducedMotion,
  ScrollTrigger,
  scrollToTarget,
  scrollToTop,
  setScrollLocked,
} from './smoothScroll.js';

export {
  createHeroTimeline,
  createMarqueeTimeline,
  createOutroTimeline,
  createStoryTimeline,
  refreshScrollTriggers,
} from './scrollTimelines.js';

export { animateCount, disconnectReveals, observeReveals } from './revealAnimations.js';
