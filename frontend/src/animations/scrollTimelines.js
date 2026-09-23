import { gsap, ScrollTrigger, prefersReducedMotion } from './smoothScroll.js';

/**
 * Page-level scroll choreography built with GSAP + ScrollTrigger.
 *
 * Two rules are applied consistently:
 *  1. every timeline is created inside a `gsap.context()` and reverted on
 *     unmount, so route changes cannot leak triggers;
 *  2. with reduced motion enabled nothing is created at all and sections are
 *     shown in their final state.
 */

/** Hero copy entrance - runs once, immediately after mount. */
export function createHeroTimeline(scope) {
  if (prefersReducedMotion()) return () => {};
  const context = gsap.context(() => {
    const lines = gsap.utils.toArray('[data-hero-line]');
    if (!lines.length) return;

    gsap
      .timeline({ defaults: { ease: 'power3.out', duration: 0.9 } })
      .from(lines, { yPercent: 120, opacity: 0, stagger: 0.09 })
      .from('[data-hero-cta]', { y: 18, opacity: 0, stagger: 0.08 }, '-=0.45')
      .from('[data-hero-stat]', { y: 14, opacity: 0, stagger: 0.06 }, '-=0.5')
      .from('[data-hero-scroll-hint]', { opacity: 0, duration: 0.6 }, '-=0.3');
  }, scope);
  return () => context.revert();
}

/**
 * Pinned storytelling block: the copy panel crossfades as the reader scrolls
 * through the 3D sequence, so the animation and the words stay in step.
 */
export function createStoryTimeline(scope) {
  if (prefersReducedMotion()) return () => {};

  const context = gsap.context(() => {
    const track = scope.querySelector('[data-story-track]');
    const panels = gsap.utils.toArray('[data-story-panel]');
    if (!track || panels.length < 2) return;

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6,
      },
    });

    panels.forEach((panel, index) => {
      if (index === 0) return;
      const previous = panels[index - 1];
      tl.to(previous.querySelector('[data-story-copy]'), { opacity: 0, y: -22, duration: 0.35 }, index - 0.35)
        .fromTo(
          panel.querySelector('[data-story-copy]'),
          { opacity: 0, y: 26 },
          { opacity: 1, y: 0, duration: 0.35 },
          index - 0.3,
        )
        .fromTo(
          panel.querySelector('[data-story-index]'),
          { scaleX: 0.15 },
          { scaleX: 1, duration: 0.4, transformOrigin: 'left center' },
          index - 0.3,
        );
    });

    // A slow drift on the whole panel column adds depth without competing with
    // the WebGL scene behind it.
    gsap.to('[data-story-copy-column]', {
      yPercent: -6,
      ease: 'none',
      scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub: true },
    });
  }, scope);

  return () => context.revert();
}

/** Fades a section out as it leaves, used by the closing call-to-action. */
export function createOutroTimeline(scope) {
  if (prefersReducedMotion()) return () => {};
  const context = gsap.context(() => {
    const section = scope.querySelector('[data-outro]');
    if (!section) return;
    gsap.fromTo(
      section.querySelectorAll('[data-outro-item]'),
      { y: 26, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        stagger: 0.08,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: { trigger: section, start: 'top 78%' },
      },
    );
  }, scope);
  return () => context.revert();
}

/** Horizontal marquee of brands/cities that reacts to vertical scroll. */
export function createMarqueeTimeline(scope) {
  if (prefersReducedMotion()) return () => {};
  const context = gsap.context(() => {
    const track = scope.querySelector('[data-marquee-track]');
    if (!track) return;
    gsap.to(track, {
      xPercent: -18,
      ease: 'none',
      scrollTrigger: { trigger: track, start: 'top bottom', end: 'bottom top', scrub: 1 },
    });
  }, scope);
  return () => context.revert();
}

/** Refreshes ScrollTrigger after layout-affecting changes (images, filters). */
export function refreshScrollTriggers() {
  ScrollTrigger.refresh();
}
