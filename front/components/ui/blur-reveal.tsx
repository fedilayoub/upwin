'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type BlurRevealElement = 'div' | 'p' | 'span';

/**
 * Word-by-word blur reveal.
 *
 * The text is rendered as a single text node on the server so headings stay
 * intact for crawlers and for `renderToStaticMarkup` assertions; the split into
 * per-word spans happens on the client, and only when motion is allowed.
 *
 * The motion itself is CSS (`.blur-reveal-word` in `app/globals.css`); this
 * component only splits the words and marks the root once it scrolls into view.
 */
export function BlurReveal({
  as: Component = 'span',
  className,
  delay = 0,
  stagger = 0.045,
  text,
}: {
  as?: BlurRevealElement;
  className?: string;
  delay?: number;
  stagger?: number;
  text: string;
}) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const source = root.textContent ?? '';
    const words = source.split(/(\s+)/).filter((chunk) => chunk.length > 0);

    let wordIndex = 0;
    const nodes = words.map((chunk) => {
      if (/^\s+$/.test(chunk)) return document.createTextNode(chunk);
      const span = document.createElement('span');
      span.className = 'blur-reveal-word';
      span.style.setProperty('--word-delay', `${delay + wordIndex * stagger}s`);
      span.textContent = chunk;
      wordIndex += 1;
      return span;
    });
    root.replaceChildren(...nodes);

    // Starts when the top of the text crosses 88% of the viewport height. Text
    // already scrolled past (a restored scroll position) reveals at once.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
          root.setAttribute('data-revealed', '');
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    observer.observe(root);

    return () => {
      observer.disconnect();
      root.removeAttribute('data-revealed');
      root.replaceChildren(document.createTextNode(source));
    };
  }, [delay, stagger, text]);

  return (
    <Component className={cn('inline-block', className)} ref={rootRef as never}>
      {text}
    </Component>
  );
}
