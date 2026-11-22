'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import type { Dictionary } from '@/i18n/types';

export function ProcessingState({ copy }: { copy: Dictionary['share'] }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  useEffect(() => {
    let count = 0;
    const timer = setInterval(() => {
      router.refresh();
      count += 1;
      if (count >= 40) {
        clearInterval(timer);
        setDone(true);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <div
      role="status"
      className="relative flex aspect-video flex-col items-center justify-center gap-4 overflow-hidden bg-zinc-950 p-6 text-center text-white sm:rounded-2xl sm:shadow-[0_30px_80px_-20px_oklch(0_0_0/0.55),0_0_0_1px_oklch(1_0_0/0.08)]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(50% 60% at 50% 100%, color-mix(in oklch, var(--hero-palette-orange) 35%, transparent), transparent 70%)',
        }}
      />
      {!done && (
        <LoaderCircle
          aria-hidden="true"
          className="relative size-8 animate-spin text-[var(--hero-palette-core)]"
        />
      )}
      <p className="relative text-sm font-medium text-white/85 sm:text-base">
        {done ? copy.stillProcessing : copy.processing}
      </p>
    </div>
  );
}
