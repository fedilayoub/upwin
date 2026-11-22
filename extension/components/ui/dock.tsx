import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

interface DockItemStyle extends CSSProperties {
  '--dock-lift': string;
  '--dock-scale': number;
  '--dock-slot-width': string;
}

const restingItemStyle: DockItemStyle = {
  '--dock-lift': '0px',
  '--dock-scale': 1,
  '--dock-slot-width': '34px',
};

export function getDockItemScale(
  distance: number,
  maximumDistance: number,
  magnification: number,
) {
  if (maximumDistance <= 0 || distance >= maximumDistance) return 1;

  const progress = Math.max(0, distance) / maximumDistance;
  const influence = (Math.cos(progress * Math.PI) + 1) / 2;

  return 1 + (Math.max(1, magnification) - 1) * influence;
}

interface DockProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
  distance?: number;
  magnification?: number;
}

export function Dock({
  children,
  className,
  distance = 82,
  magnification = 1.38,
  onPointerLeave,
  onPointerMove,
  ...props
}: DockProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    const media = globalThis.matchMedia(REDUCED_MOTION_QUERY);
    const updatePreference = () => {
      prefersReducedMotion.current = media.matches;
      if (media.matches) resetItems();
    };

    updatePreference();
    media.addEventListener('change', updatePreference);

    return () => media.removeEventListener('change', updatePreference);
  }, []);

  function getItems() {
    return dockRef.current?.querySelectorAll<HTMLElement>('[data-dock-item]');
  }

  function resetItems() {
    getItems()?.forEach((item) => {
      item.style.setProperty('--dock-scale', '1');
      item.style.setProperty('--dock-lift', '0px');
      item.style.setProperty('--dock-slot-width', '34px');
    });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    onPointerMove?.(event);
    if (event.defaultPrevented) return;

    if (event.pointerType === 'touch' || prefersReducedMotion.current) {
      resetItems();
      return;
    }

    const dock = dockRef.current;
    const items = getItems();
    if (!dock || !items) return;

    const pointerX = event.clientX - dock.getBoundingClientRect().left;

    items.forEach((item) => {
      const itemCenter = item.offsetLeft + item.offsetWidth / 2;
      const scale = getDockItemScale(
        Math.abs(pointerX - itemCenter),
        distance,
        magnification,
      );

      item.style.setProperty('--dock-scale', scale.toFixed(3));
      item.style.setProperty('--dock-lift', `${-(scale - 1) * 18}px`);
      item.style.setProperty('--dock-slot-width', `${34 * scale}px`);
    });
  }

  function handlePointerLeave(event: ReactPointerEvent<HTMLDivElement>) {
    resetItems();
    onPointerLeave?.(event);
  }

  return (
    <div
      className={cn(
        'flex h-12 items-end gap-1 rounded-[15px] border border-border/80 bg-background/88 p-1.5 shadow-[0_16px_40px_-22px_color-mix(in_oklab,var(--foreground)_36%,transparent),inset_0_1px_0_color-mix(in_oklab,var(--foreground)_8%,transparent)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/74',
        className,
      )}
      data-slot="dock"
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      ref={dockRef}
      {...props}
    >
      {children}
    </div>
  );
}

interface DockItemProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  active?: boolean;
  children: ReactNode;
  label: string;
}

export function DockItem({
  active = false,
  'aria-current': ariaCurrent,
  'aria-label': ariaLabel,
  children,
  className,
  disabled,
  label,
  onClick,
  style,
  type = 'button',
  ...props
}: DockItemProps) {
  const iconRef = useRef<HTMLSpanElement>(null);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!disabled && !globalThis.matchMedia(REDUCED_MOTION_QUERY).matches) {
      iconRef.current?.animate(
        [
          { transform: 'translateY(0)' },
          { transform: 'translateY(-7px)' },
          { transform: 'translateY(1px)' },
          { transform: 'translateY(0)' },
        ],
        {
          duration: 420,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        },
      );
    }

    onClick?.(event);
  }

  return (
    <div
      className="flex h-[34px] w-[var(--dock-slot-width)] shrink-0 items-end justify-center transition-[width] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      data-dock-item=""
      data-slot="dock-item-slot"
      style={restingItemStyle}
    >
      <button
        aria-current={ariaCurrent ?? (active ? 'page' : undefined)}
        aria-label={ariaLabel ?? label}
        className={cn(
          'group relative grid size-[34px] shrink-0 origin-bottom place-items-center rounded-[10px] outline-none will-change-transform [transform:translate3d(0,var(--dock-lift),0)_scale(var(--dock-scale))] transition-[transform,background-color,color,box-shadow] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:will-change-auto focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:brightness-95 disabled:pointer-events-none disabled:opacity-45',
          active
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground',
          className,
        )}
        data-active={active ? 'true' : 'false'}
        data-slot="dock-item"
        disabled={disabled}
        onClick={handleClick}
        style={style}
        type={type}
        {...props}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-[11px] leading-none font-medium whitespace-nowrap text-background opacity-0 shadow-sm transition-opacity duration-150 motion-reduce:transition-none group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {label}
        </span>
        <span
          className="grid place-items-center"
          data-slot="dock-icon"
          ref={iconRef}
        >
          {children}
        </span>
      </button>
    </div>
  );
}
