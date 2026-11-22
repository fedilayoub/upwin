import { Hardware } from '@/components/ui/hardware/hardware';
import type { VideoLimits } from '@/lib/api/types';
import type { VideoAllowanceCopy } from '@/i18n/video-types';
import type { Locale } from '@/i18n/config';
import { formatStorage } from '@/lib/videos';

/**
 * The storage this install uses. There are no plans, no caps and no expiry:
 * the bucket belongs to the freelancer.
 */
export function VideoAllowance({
  limits,
  copy,
  locale,
  embedded = false,
}: {
  limits: VideoLimits;
  copy: VideoAllowanceCopy;
  locale: Locale;
  embedded?: boolean;
}) {
  if (!limits.available) return null;
  const storageLabel = copy.storage.replace(
    '{used}',
    formatStorage(limits.storage.usedBytes, locale),
  );
  const Heading = embedded ? 'h3' : 'h2';
  return (
    <section
      aria-label={copy.title}
      className={embedded
        ? 'flex flex-wrap items-center gap-x-5 gap-y-2 text-sm'
        : 'flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-card px-4 py-2.5 text-sm'}
    >
      <Heading className="font-semibold">{copy.title}</Heading>
      <Hardware className="hardware-stats order-2 min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-0">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <p>{storageLabel}</p>
          <p data-hardware="muted">{copy.retentionForever}</p>
        </div>
      </Hardware>
    </section>
  );
}
