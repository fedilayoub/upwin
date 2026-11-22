import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
  size?: 'small' | 'default' | 'large';
}

export function BrandMark({
  className,
  size = 'default',
}: BrandMarkProps) {
  const isLarge = size === 'large';
  const isSmall = size === 'small';

  return (
    <span
      aria-label="upwin"
      className={cn(
        'inline-flex shrink-0 items-center font-semibold tracking-[-0.035em] text-foreground',
        isLarge
          ? 'gap-2.5 text-xl'
          : isSmall
            ? 'gap-2 text-[0.95rem]'
            : 'gap-2 text-base',
        className,
      )}
      role="img"
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid shrink-0 place-items-center rounded-full bg-foreground text-background shadow-xs ring-1 ring-border',
          isLarge ? 'size-10' : isSmall ? 'size-6' : 'size-8',
        )}
      >
        <svg
          className={isLarge ? 'size-5' : isSmall ? 'size-3' : 'size-4'}
          fill="none"
          viewBox="0 0 16 16"
        >
          <path
            d="M3 2.5v6.25a5 5 0 0 0 10 0V2.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.2"
          />
          <path
            d="m10.2 4.9 2.8-2.4 2 2"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
        </svg>
      </span>
      <span aria-hidden="true">upwin</span>
    </span>
  );
}
