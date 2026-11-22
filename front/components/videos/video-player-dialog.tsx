'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, ExternalLink, LoaderCircle } from 'lucide-react';
import { getVideoPlaybackAction } from '@/app/[lang]/(app)/videos/actions';
import { VideoPlayer } from '@/app/[lang]/(share)/v/[slug]/video-player';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PublicVideo, Video } from '@/lib/api/types';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; video: PublicVideo };

/**
 * Plays a video in the app, over the library. The public share page stays the
 * link sent to clients; this only saves the owner a tab. Mount it only while
 * open: each mount fetches fresh presigned URLs.
 */
export function VideoPlayerDialog({
  video,
  title,
  locale,
  copy,
  shareCopy,
  onClose,
}: {
  video: Video;
  title: string;
  locale: Locale;
  copy: Dictionary['videos'];
  shareCopy: Dictionary['share'];
  onClose: () => void;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = (initial: boolean) =>
    getVideoPlaybackAction(locale, video.slug).then(
      (result) => {
        if (result.status === 'success')
          setState({ kind: 'ready', video: result.video });
        // A failed refresh keeps the current player; it shows its own error.
        else if (initial) setState({ kind: 'error', message: result.message });
      },
      () => {
        if (initial) setState({ kind: 'error', message: copy.loadError });
      },
    );

  useEffect(() => {
    void load(true);
    // One fetch per mount; the dialog is unmounted on close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        closeLabel={copy.cancel}
        className="max-w-5xl gap-3 bg-transparent p-0 shadow-none sm:max-w-[min(64rem,calc(100%-4rem))]"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{shareCopy.player}</DialogDescription>
        {state.kind === 'ready' ? (
          state.video.status === 'ready' ? (
            <VideoPlayer
              video={state.video}
              copy={shareCopy}
              autoPlay
              showOwnerNote={false}
              onSourceExpired={() => void load(false)}
            />
          ) : (
            <Placeholder video={video}>
              <LoaderCircle className="size-6 animate-spin" aria-hidden />
            </Placeholder>
          )
        ) : state.kind === 'loading' ? (
          <Placeholder video={video}>
            <LoaderCircle className="size-6 animate-spin" aria-hidden />
          </Placeholder>
        ) : (
          <Placeholder video={video}>
            <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center text-sm">
              <CircleAlert className="size-6" aria-hidden />
              <p role="alert">{state.message}</p>
              <Button asChild size="sm" variant="secondary">
                <a href={video.shareUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden />
                  {copy.open}
                </a>
              </Button>
            </div>
          </Placeholder>
        )}
        <p className="truncate px-1 text-sm font-medium text-white">{title}</p>
      </DialogContent>
    </Dialog>
  );
}

function Placeholder({
  video,
  children,
}: {
  video: Video;
  children: React.ReactNode;
}) {
  const w = video.width ?? 16;
  const h = video.height ?? 9;
  return (
    <div
      className="relative mx-auto grid place-items-center overflow-hidden bg-black text-white sm:rounded-2xl"
      style={{
        aspectRatio: `${w}/${h}`,
        width: `min(100%, calc(78vh * ${w} / ${h}))`,
      }}
    >
      {video.thumbnailUrl && (
        // Presigned URL; never cached by next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={video.thumbnailUrl}
          alt=""
          className="absolute inset-0 size-full object-contain opacity-40"
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
