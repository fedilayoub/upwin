'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reports when an element first comes within `margin` of the viewport, and stays
 * true from then on. For deferring work that is only worth doing once the
 * visitor is about to see the result, such as importing a chart library.
 */
export function useNearViewport<T extends Element>(margin = '600px') {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || near) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true);
      },
      { rootMargin: margin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [margin, near]);

  return { near, ref };
}
