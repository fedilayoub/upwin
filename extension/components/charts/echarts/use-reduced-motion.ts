import { useEffect, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Local stand-in for `motion/react`'s `useReducedMotion`.
 *
 * The vendored EvilCharts radial chart used `motion` for exactly two things: this
 * hook, which gates the intro sweep, and a 250ms fade on the loading badge.
 * That is 133 kB minified in a side-panel bundle that ships to the browser, so
 * the hook lives here and the badge renders without the fade.
 *
 * The initial value is read during render rather than in an effect: the chart
 * decides whether to animate on its FIRST option push, so a value that only
 * lands one render later would sweep in once for a reduce-motion user. Guarded
 * for the `node` test environment, where the chart renders with no `window`.
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = (event: MediaQueryListEvent) =>
      setPrefersReducedMotion(event.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}
