import { cn } from '@/lib/utils';

const WIDTH = 100;
const HEIGHT = 32;
const PADDING = 2;

export function Sparkline({
  className,
  values,
}: {
  className?: string;
  values: number[];
}) {
  const points = toPoints(values);

  return (
    <svg
      aria-label="Winning Score trend"
      className={cn('h-8 w-full overflow-visible text-primary', className)}
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      {points.length === 1 ? (
        <circle
          className="fill-current"
          cx={points[0]?.x}
          cy={points[0]?.y}
          data-sparkline-point
          r="2"
        />
      ) : points.length > 1 ? (
        <polyline
          className="fill-none stroke-current"
          data-sparkline-line
          points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}

function toPoints(values: number[]): Array<{ x: number; y: number }> {
  if (values.length === 0) return [];

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum;

  return values.map((value, index) => ({
    x:
      values.length === 1
        ? WIDTH / 2
        : PADDING + (index / (values.length - 1)) * (WIDTH - PADDING * 2),
    y:
      range === 0
        ? HEIGHT / 2
        : HEIGHT -
          PADDING -
          ((value - minimum) / range) * (HEIGHT - PADDING * 2),
  }));
}
