import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * jsdom does not implement the browser APIs the app touches during render
 * (scroll-driven animation, media queries, canvas). They are stubbed here so
 * component tests exercise the real components rather than mocks.
 */
afterEach(() => {
  cleanup();
});

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

class MockObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

if (!window.IntersectionObserver) window.IntersectionObserver = MockObserver;
if (!window.ResizeObserver) window.ResizeObserver = MockObserver;

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 16);
  window.cancelAnimationFrame = (handle) => clearTimeout(handle);
}

if (!window.scrollTo) window.scrollTo = vi.fn();

// Three.js probes for a WebGL context; without one the scene takes the
// documented static fallback path, which is also what mobile Safari in
// low-power mode sees in production.
if (!HTMLCanvasElement.prototype.getContext) {
  HTMLCanvasElement.prototype.getContext = () => null;
}
