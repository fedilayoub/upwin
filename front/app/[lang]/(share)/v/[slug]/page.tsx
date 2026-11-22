import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CalendarDays, Clock3 } from 'lucide-react';
import { LogoMark } from '@/components/logo/logo-mark';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getPublicVideo } from '@/lib/api/server';
import { formatDuration } from '@/lib/videos';
import { ProcessingState } from './processing-state';
import { VideoPlayer } from './video-player';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const [result, dictionary] = await Promise.all([
    getPublicVideo(slug),
    getDictionary(lang),
  ]);
  const title =
    result.kind === 'ok'
      ? `${result.video.title} · ${dictionary.share.video}`
      : dictionary.share.unavailable;
  // The poster route answers 404 until the video is ready, and a scraper caches
  // an empty card for days, so a link preview carries a poster only when there is one.
  const appUrl = process.env.APP_URL?.trim();
  const images =
    appUrl &&
    result.kind === 'ok' &&
    result.video.status === 'ready' &&
    result.video.posterUrl
      ? [new URL(`/api/videos/${slug}/poster`, appUrl).toString()]
      : [];
  return {
    title: { absolute: title },
    description: dictionary.share.description,
    robots: { index: false, follow: false },
    openGraph: {
      type: 'video.other',
      title,
      description: dictionary.share.description,
      url: `/${lang}/v/${slug}`,
      images,
    },
    twitter: {
      card: images.length ? 'summary_large_image' : 'summary',
      title,
      description: dictionary.share.description,
      images,
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const [result, dictionary] = await Promise.all([
    getPublicVideo(slug),
    getDictionary(lang),
  ]);
  const copy = dictionary.share;
  if (result.kind === 'not-found') notFound();
  const { video } = result;
  const recorded = copy.recorded.replace(
    '{date}',
    new Intl.DateTimeFormat(lang, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(video.createdAt)),
  );
  return (
    <article>
      <header className="mx-auto max-w-3xl pt-4 text-center sm:pt-8">
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--marketing-border)] bg-[var(--marketing-surface)]/60 px-3 py-1 text-xs font-medium text-[var(--marketing-text-muted)] backdrop-blur">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-[var(--landing-accent)]"
          />
          {copy.eyebrow}
        </p>
        <h1 className="mt-4 line-clamp-3 pb-1 text-balance break-words text-3xl leading-[1.15] font-semibold tracking-[-0.03em] sm:text-5xl sm:leading-[1.1]">
          {video.title}
        </h1>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-[var(--marketing-text-muted)]">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Clock3 className="size-4" aria-hidden="true" />
            {formatDuration(video.durationMs)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden="true" />
            {recorded}
          </span>
        </p>
      </header>
      <div className="-mx-4 mt-8 sm:mx-0 sm:mt-12">
        {video.status === 'processing' ? (
          <ProcessingState copy={copy} />
        ) : (
          <VideoPlayer video={video} copy={copy} />
        )}
      </div>
      {/* Plain text, not a link: the rest of this site is the freelancer's own private app. */}
      <footer className="mt-12 flex flex-wrap items-center gap-2 border-t border-[var(--marketing-border)] pt-6 text-sm text-[var(--marketing-text-muted)]">
        <span className="grid size-6 place-items-center rounded-full bg-[var(--marketing-text)] text-[var(--landing-page-background)]">
          <LogoMark className="size-3" />
        </span>
        <span>
          {copy.recordedWith}{' '}
          <span className="font-semibold text-[var(--marketing-text)]">upwin</span>
        </span>
      </footer>
    </article>
  );
}
