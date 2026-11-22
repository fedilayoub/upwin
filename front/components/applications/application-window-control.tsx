'use client';

import { useId } from 'react';
import { useRouter } from 'next/navigation';
import { Segmented } from '@/components/ui/hardware/segmented';
import { FUNNEL_WINDOWS, type ApplicationStats } from '@/lib/api';
import type { Dictionary } from '@/i18n/types';
import type { ApplicationView } from '@/lib/application-view';

export function ApplicationWindowControl({
  copy,
  locale,
  value,
  view,
}: {
  copy: Dictionary['applications']['stats'];
  locale: string;
  value: ApplicationStats['window'];
  view?: ApplicationView;
}) {
  const id = useId();
  const router = useRouter();
  return (
    <div>
      <p className="sr-only" id={id}>
        {copy.windowLabel}
      </p>
      <Segmented
        aria-labelledby={id}
        name="window"
        value={value}
        onValueChange={(window) => {
          const query = new URLSearchParams(view ? { window, view } : { window });
          router.push(`/${locale}/applications?${query}`);
        }}
        options={FUNNEL_WINDOWS.map((window) => ({
          value: window,
          label: copy.windows[window],
        }))}
      />
    </div>
  );
}
