'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { MotionProps } from 'motion/react';
import { Children, memo, useEffect, useMemo, useState } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

function AnimatedListItem({ children }: { children: ReactNode }) {
  const animations: MotionProps = {
    initial: { scale: 0.92, opacity: 0, y: -16 },
    animate: { scale: 1, opacity: 1, y: 0, originY: 0 },
    exit: { scale: 0.94, opacity: 0 },
    transition: { type: 'spring', stiffness: 320, damping: 34 },
  };

  return (
    <motion.li {...animations} className="w-full list-none" layout>
      {children}
    </motion.li>
  );
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<'ul'> {
  children: ReactNode;
  /** Milliseconds between two arrivals. */
  delay?: number;
  /** How many items stay on screen before the oldest is dropped. */
  maxVisible?: number;
}

/**
 * A feed that keeps emitting: items arrive at the top, the stack shifts down,
 * the oldest leaves. Loops over `children` forever so the card never goes quiet.
 */
export const AnimatedList = memo(
  ({ children, className, delay = 2200, maxVisible = 4, ...props }: AnimatedListProps) => {
    const items = useMemo(() => Children.toArray(children), [children]);
    const reducedMotion = useReducedMotion();
    const [emitted, setEmitted] = useState(1);

    useEffect(() => {
      if (reducedMotion || items.length < 2) return;
      const timer = setInterval(() => {
        // A hidden tab pauses exit animations but not intervals, so emitting
        // there piles up rows that never leave and inflates the layout.
        if (document.hidden) return;
        setEmitted((current) => current + 1);
      }, delay);
      return () => clearInterval(timer);
    }, [delay, items.length, reducedMotion]);

    if (reducedMotion) {
      return (
        <ul className={cn('flex w-full flex-col gap-3', className)} {...props}>
          {items.slice(0, maxVisible).map((item, index) => (
            <li className="w-full list-none" key={`static-${index}`}>
              {item}
            </li>
          ))}
        </ul>
      );
    }

    const first = Math.max(0, emitted - maxVisible);
    const visible = Array.from(
      { length: emitted - first },
      (_, offset) => first + offset,
    ).reverse();

    return (
      <ul className={cn('flex w-full flex-col gap-3', className)} {...props}>
        <AnimatePresence initial={false}>
          {visible.map((tick) => (
            <AnimatedListItem key={tick}>{items[tick % items.length]}</AnimatedListItem>
          ))}
        </AnimatePresence>
      </ul>
    );
  },
);

AnimatedList.displayName = 'AnimatedList';
