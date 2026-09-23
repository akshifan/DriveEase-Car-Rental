import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client.js';

/**
 * Runs an async loader and exposes {data, error, loading, reload}.
 * Keeps every page from re-implementing the same three-state dance, while
 * still ignoring responses that arrive after unmount (or after the deps move on).
 */
export function useApiResource(loader, deps = [], { immediate = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const requestId = useRef(0);
  const loaderRef = useRef(loader);

  // Always call the latest closure without making it a dependency of the effect.
  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    if (!immediate) return undefined;
    const id = ++requestId.current;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.resolve()
      .then(() => loaderRef.current())
      .then((result) => {
        if (cancelled || id !== requestId.current) return;
        setData(result);
      })
      .catch((failure) => {
        if (cancelled || id !== requestId.current) return;
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message }));
      })
      .finally(() => {
        if (cancelled || id !== requestId.current) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshIndex, immediate]);

  const reload = useCallback(() => setRefreshIndex((index) => index + 1), []);

  return { data, error, loading, reload, setData };
}

/** Debounces a rapidly changing value (search-as-you-type inputs). */
export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** Matches a CSS media query and keeps the result in sync (pointer, width, ...). */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', handler);
    return () => list.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** True when the visitor asked for less motion; the 3D scene reads this too. */
export function usePrefersReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** Locks body scroll (modals, mobile drawers) while mounted. */
export function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}

/** Calls `handler` on Escape while `active`. */
export function useEscapeKey(active, handler) {
  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') handler(event);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, handler]);
}

/** Traps focus inside the referenced element while `active` (dialog a11y). */
export function useFocusTrap(active, containerRef) {
  useEffect(() => {
    if (!active || !containerRef.current) return undefined;
    const container = containerRef.current;
    const selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const previous = document.activeElement;

    const focusFirst = () => {
      const focusable = container.querySelectorAll(selector);
      if (focusable.length) focusable[0].focus();
    };
    focusFirst();

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(container.querySelectorAll(selector)).filter(
        (element) => element.offsetParent !== null,
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [active, containerRef]);
}

/** Tracks window scroll offset in a rAF-throttled way. */
export function useScrollPosition(threshold = 12) {
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        setPassed(window.scrollY > threshold);
        frame = 0;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return passed;
}
