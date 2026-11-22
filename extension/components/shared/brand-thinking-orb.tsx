import {
  useEffect,
  useRef,
  useState,
  type CanvasHTMLAttributes,
  type CSSProperties,
} from 'react';
import {
  MODE_DRAWS,
  resolvePreset,
  type OrbSize,
  type OrbState,
} from 'thinking-orbs/engine';

const ORB_LABELS: Readonly<Record<OrbState, string>> = {
  working: 'Working…',
  searching: 'Searching…',
  solving: 'Solving…',
  listening: 'Listening…',
  connecting: 'Connecting…',
  weaving: 'Weaving…',
  composing: 'Composing…',
  breathing: 'Thinking…',
  shaping: 'Shaping…',
};

type CanvasProps = Omit<
  CanvasHTMLAttributes<HTMLCanvasElement>,
  'children' | 'color' | 'height' | 'width'
>;

export interface BrandThinkingOrbProps extends CanvasProps {
  color?: CSSProperties['color'];
  paused?: boolean;
  size?: OrbSize;
  speed?: number;
  state?: OrbState;
}

/**
 * A thinking-orbs canvas with a host-controlled ink color. The upstream
 * component exposes only light/dark monochrome themes, while its public engine
 * export lets us retain the tuned animations and composite them with upwin's
 * WebGL/extension green (or any caller-provided CSS color).
 */
export function BrandThinkingOrb({
  color = 'var(--thinking-orb-ink)',
  paused = false,
  size = 64,
  speed = 1,
  state = 'working',
  style,
  'aria-label': ariaLabel,
  ...canvasProps
}: BrandThinkingOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const context = canvas.getContext('2d');
    if (!context) return;

    const { mode, opts, speed: presetSpeed } = resolvePreset(state, size);
    const draw = MODE_DRAWS[mode];
    const effectiveSpeed = presetSpeed * speed;
    let ink = getComputedStyle(canvas).color || 'oklch(0.28 0.12 155)';

    const paintFrame = (timeSeconds: number) => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, size, size);

      context.save();
      draw(context, size, timeSeconds, true, opts);
      context.restore();

      context.save();
      context.globalCompositeOperation = 'source-in';
      context.fillStyle = ink;
      context.fillRect(0, 0, size, size);
      context.restore();
    };

    // The page launcher resolves its stored theme after the canvas mounts.
    // Canvas pixels do not follow later CSS variable changes, so watch the
    // nearest theme owner and repaint with its newly computed ink.
    const themeOwner = canvas.closest<HTMLElement>('[data-theme]');
    const themeObserver =
      themeOwner && typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            ink = getComputedStyle(canvas).color || ink;
            paintFrame((performance.now() / 1000) * effectiveSpeed);
          })
        : null;
    if (themeOwner) {
      themeObserver?.observe(themeOwner, {
        attributeFilter: ['data-theme'],
        attributes: true,
      });
    }

    if (reducedMotion) {
      paintFrame(0.6);
      return () => themeObserver?.disconnect();
    }

    let animationFrame = 0;
    let isRunning = false;
    let isVisible = true;

    const stop = () => {
      isRunning = false;
      cancelAnimationFrame(animationFrame);
    };
    const loop = () => {
      paintFrame((performance.now() / 1000) * effectiveSpeed);
      if (isRunning) animationFrame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (isRunning || paused) return;
      isRunning = true;
      animationFrame = requestAnimationFrame(loop);
    };

    paintFrame((performance.now() / 1000) * effectiveSpeed);

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            isVisible = entry?.isIntersecting ?? false;
            if (isVisible && document.visibilityState !== 'hidden') start();
            else stop();
          });
    observer?.observe(canvas);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') stop();
      else if (isVisible) start();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (!observer) start();

    return () => {
      stop();
      observer?.disconnect();
      themeObserver?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [color, paused, reducedMotion, size, speed, state]);

  return (
    <canvas
      aria-label={ariaLabel ?? ORB_LABELS[state]}
      data-orb-state={state}
      ref={canvasRef}
      role="img"
      style={{
        display: 'block',
        height: size,
        width: size,
        ...style,
        color,
      }}
      {...canvasProps}
    />
  );
}

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;

    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reducedMotion;
}
