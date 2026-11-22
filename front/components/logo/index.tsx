import Link from 'next/link';
import { LogoMark } from '@/components/logo/logo-mark';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

const Logo = ({
  locale,
  compact = false,
  size = 'default',
  variant = 'app',
}: {
  locale: Locale;
  compact?: boolean;
  size?: 'default' | 'small';
  variant?: 'app' | 'marketing';
}) => {
  const isSmall = size === 'small';
  const isMarketing = variant === 'marketing';

  return (
    <Link
      aria-label="upwin home"
      href={`/${locale}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full font-semibold tracking-[-0.035em] outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        isSmall ? 'text-[0.95rem]' : 'text-base',
        isMarketing
          ? 'text-[var(--hero-control-text)] focus-visible:ring-[var(--hero-focus)] focus-visible:ring-offset-transparent'
          : 'text-sidebar-foreground focus-visible:ring-sidebar-ring focus-visible:ring-offset-sidebar',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid shrink-0 place-items-center rounded-full',
          isSmall ? (isMarketing ? 'size-7' : 'size-6') : 'size-8',
          isMarketing
            ? 'bg-[var(--hero-control-text)] text-[var(--hero-control-surface)]'
            : 'bg-sidebar-foreground text-sidebar',
        )}
      >
        <LogoMark className={isSmall ? (isMarketing ? 'size-3.5' : 'size-3') : 'size-4'} />
      </span>
      {!compact && <span>upwin</span>}
    </Link>
  );
};

export default Logo;
