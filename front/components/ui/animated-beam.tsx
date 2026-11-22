'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useState } from 'react';
import type { RefObject } from 'react';
import { cn } from '@/lib/utils';

export interface AnimatedBeamProps {
  className?: string;
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  curvature?: number;
  reverse?: boolean;
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  delay?: number;
  duration?: number;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
}

/**
 * Draws a line between two elements inside a shared container and runs a light
 * pulse along it. Adapted from magicui so the colors come from landing tokens
 * and the pulse collapses to a static hairline under reduced motion.
 */
export function AnimatedBeam({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  duration = 4,
  delay = 0,
  pathColor = 'var(--landing-line)',
  pathWidth = 1.75,
  pathOpacity = 0.62,
  gradientStartColor = 'var(--landing-accent)',
  gradientStopColor = 'var(--landing-accent-warm)',
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
}: AnimatedBeamProps) {
  const id = useId().replace(/:/g, '');
  const reducedMotion = useReducedMotion();
  const [pathD, setPathD] = useState('');
  const [size, setSize] = useState({ height: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const from = fromRef.current;
    const to = toRef.current;
    if (!container || !from || !to) return;

    const updatePath = () => {
      const containerRect = container.getBoundingClientRect();
      const fromRect = from.getBoundingClientRect();
      const toRect = to.getBoundingClientRect();

      setSize({ height: containerRect.height, width: containerRect.width });

      const startX = fromRect.left - containerRect.left + fromRect.width / 2 + startXOffset;
      const startY = fromRect.top - containerRect.top + fromRect.height / 2 + startYOffset;
      const endX = toRect.left - containerRect.left + toRect.width / 2 + endXOffset;
      const endY = toRect.top - containerRect.top + toRect.height / 2 + endYOffset;
      const controlY = (startY + endY) / 2 - curvature;

      setPathD(`M ${startX},${startY} Q ${(startX + endX) / 2},${controlY} ${endX},${endY}`);
    };

    const observer = new ResizeObserver(updatePath);
    observer.observe(container);
    observer.observe(from);
    observer.observe(to);
    updatePath();

    return () => observer.disconnect();
  }, [containerRef, curvature, endXOffset, endYOffset, fromRef, startXOffset, startYOffset, toRef]);

  const gradientCoordinates = reverse
    ? { x1: ['90%', '-10%'], x2: ['100%', '0%'], y1: ['0%', '0%'], y2: ['0%', '0%'] }
    : { x1: ['10%', '110%'], x2: ['0%', '100%'], y1: ['0%', '0%'], y2: ['0%', '0%'] };

  return (
    <svg
      aria-hidden="true"
      className={cn('pointer-events-none absolute top-0 left-0 transform-gpu', className)}
      fill="none"
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      width={size.width}
    >
      <path
        d={pathD}
        stroke={pathColor}
        strokeLinecap="round"
        strokeOpacity={pathOpacity}
        strokeWidth={pathWidth}
      />
      {reducedMotion ? null : (
        <>
          <path
            d={pathD}
            stroke={`url(#${id})`}
            strokeLinecap="round"
            strokeOpacity="1"
            strokeWidth={pathWidth + 1}
          />
          <defs>
            <motion.linearGradient
              animate={{
                x1: gradientCoordinates.x1,
                x2: gradientCoordinates.x2,
                y1: gradientCoordinates.y1,
                y2: gradientCoordinates.y2,
              }}
              className="transform-gpu"
              gradientUnits="userSpaceOnUse"
              id={id}
              initial={{ x1: '0%', x2: '0%', y1: '0%', y2: '0%' }}
              transition={{
                delay,
                duration,
                ease: [0.16, 1, 0.3, 1],
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 0.6,
              }}
            >
              <stop stopColor={gradientStartColor} stopOpacity="0" />
              <stop stopColor={gradientStartColor} />
              <stop offset="32.5%" stopColor={gradientStopColor} />
              <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
            </motion.linearGradient>
          </defs>
        </>
      )}
    </svg>
  );
}
