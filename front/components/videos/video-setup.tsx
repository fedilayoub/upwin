import { BookOpen, PlugZap, Video } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StarBorder } from '@/components/ui/star-border';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';

/** What the API's .env needs. Placeholders only: the real keys never reach this app. */
const ENV_LINES = [
  'VIDEO_STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com',
  'VIDEO_STORAGE_BUCKET=upwin-videos',
  'VIDEO_STORAGE_ACCESS_KEY_ID=<access key id>',
  'VIDEO_STORAGE_SECRET_ACCESS_KEY=<secret>',
];

export const VIDEO_SETUP_GUIDE_PATH = 'back/docs/VIDEO-STORAGE-SETUP.md';

/**
 * Shown instead of the library while the API has video off. A setup path, not
 * an error: three steps, the exact lines to paste, and where the full guide is.
 */
export function VideoSetup({
  copy,
  locale,
}: {
  copy: Dictionary['videos']['setup'];
  locale: Locale;
}) {
  return (
    <StarBorder
      as="section"
      aria-labelledby="video-setup-title"
      className="bg-card p-6 sm:p-8"
      data-video-setup
    >
      <div className="flex flex-col gap-3">
        <StarBorder
          aria-hidden="true"
          as="span"
          className="grid size-10 place-items-center bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]"
        >
          <Video className="size-5" strokeWidth={2} />
        </StarBorder>
        <h2 className="text-lg font-semibold tracking-[-0.02em]" id="video-setup-title">
          {copy.title}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{copy.description}</p>
      </div>

      <ol className="mt-6 grid gap-5 border-t border-border/70 pt-6">
        {copy.steps.map((step, index) => (
          <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3" key={step.title}>
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-full bg-[var(--dashboard-accent-soft)] text-xs font-semibold text-[var(--dashboard-accent)] tabular-nums"
            >
              {index + 1}
            </span>
            <div className="min-w-0 space-y-1.5 pt-0.5">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-sm leading-6 text-muted-foreground">{step.body}</p>
              {index === 1 ? (
                <pre className="overflow-x-auto rounded-md border border-border/70 bg-muted/60 px-3 py-2.5 font-mono text-xs leading-6">
                  {ENV_LINES.join('\n')}
                </pre>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <BookOpen aria-hidden="true" className="size-4 shrink-0" />
          <span className="shrink-0">{copy.guide}:</span>
          <code className="truncate font-mono text-xs text-foreground">{VIDEO_SETUP_GUIDE_PATH}</code>
        </p>
        <Button asChild className="shrink-0" size="sm" variant="outline">
          <Link href={`/${locale}/settings/connection`}>
            <PlugZap />
            {copy.check}
          </Link>
        </Button>
      </div>
    </StarBorder>
  );
}
