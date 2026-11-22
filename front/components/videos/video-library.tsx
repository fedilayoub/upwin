'use client';

import { useState, useTransition } from 'react';
import { Chrome } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteVideoAction,
  loadMoreVideosAction,
  renameVideoAction,
} from '@/app/[lang]/(app)/videos/actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import type { Video, VideoListResponse } from '@/lib/api/types';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { formatDuration } from '@/lib/videos';
import { VideoPlayerDialog } from '@/components/videos/video-player-dialog';
import { cn } from '@/lib/utils';
import {
  Check,
  CircleAlert,
  CircleCheck,
  Ellipsis,
  ExternalLink,
  Eye,
  Film,
  Gauge,
  Link2,
  LoaderCircle,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react';

type Copy = Dictionary['videos'];
type VideoCopy = Dictionary['video'];
type ShareCopy = Dictionary['share'];

export function VideoLibrary({
  page,
  locale,
  copy,
  videoCopy,
  shareCopy,
  now,
}: {
  page: VideoListResponse;
  locale: Locale;
  copy: Copy;
  videoCopy: VideoCopy;
  shareCopy: ShareCopy;
  now: number;
}) {
  const [additional, setAdditional] = useState<VideoListResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const items = [...page.items, ...(additional?.items ?? [])].filter(
    (item, index, all) => all.findIndex((v) => v.id === item.id) === index,
  );
  const cursor = additional ? additional.nextCursor : page.nextCursor;
  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-8 text-center text-muted-foreground">
          <p className="max-w-md">{copy.empty}</p>
          <Button asChild>
            <Link href={`/${locale}/settings/connection`}>
              <Chrome />
              {copy.extension}
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((video) => (
            <VideoCard
              key={video.id}
              now={now}
              video={video}
              locale={locale}
              copy={copy}
              videoCopy={videoCopy}
              shareCopy={shareCopy}
            />
          ))}
        </div>
      )}
      {cursor && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await loadMoreVideosAction(locale, cursor);
              if (result.status === 'error') {
                toast.error(result.message);
                return;
              }
              setAdditional((previous) => ({
                items: [...(previous?.items ?? []), ...result.page.items],
                nextCursor: result.page.nextCursor,
              }));
            })
          }
        >
          {copy.loadMore}
        </Button>
      )}
    </div>
  );
}

function VideoCard({
  video,
  locale,
  copy,
  videoCopy,
  shareCopy,
  now,
}: {
  video: Video;
  locale: Locale;
  copy: Copy;
  videoCopy: VideoCopy;
  shareCopy: ShareCopy;
  now: number;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(video.title);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pending, startTransition] = useTransition();
  if (deleted) return null;
  const failed = video.status === 'failed';
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(video.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(copy.messages.copyError);
    }
  };
  const startRename = () => {
    setTitle(savedTitle ?? video.title);
    setEditing(true);
  };
  return (
    <Card className="group/card flex h-full flex-col gap-4 rounded-3xl p-4 shadow-none transition-colors hover:border-foreground/20">
      <a
        href={video.shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${copy.play}: ${savedTitle ?? video.title}`}
        onClick={(event) => {
          // Plain clicks play in the app; Cmd/Ctrl/Shift/middle-click still open the share page.
          if (
            video.status !== 'ready' ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          setPlaying(true);
        }}
        className="relative block aspect-video overflow-hidden rounded-2xl bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        {video.thumbnailUrl ? (
          // Presigned URLs must be requested directly, never cached by next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="size-full object-cover transition-transform duration-300 group-hover/card:scale-[1.03]"
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
          />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground">
            <Film className="size-8" aria-hidden />
          </span>
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors duration-200 group-hover/card:bg-black/30">
          <span className="grid size-12 scale-90 place-items-center rounded-full bg-white/95 text-zinc-900 opacity-0 shadow-lg transition-all duration-200 group-hover/card:scale-100 group-hover/card:opacity-100">
            <Play className="size-5 translate-x-px fill-current" aria-hidden />
          </span>
        </span>
        {video.averageWatchedPercent !== null && (
          // How far viewers get, on average: the bar YouTube draws for watched videos.
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <span
              className="block h-full bg-primary"
              style={{ width: `${video.averageWatchedPercent}%` }}
            />
          </span>
        )}
        {video.durationMs !== null && (
          <span className="absolute right-2 bottom-2 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
            {formatDuration(video.durationMs)}
          </span>
        )}
      </a>
      <div className="flex flex-1 flex-col gap-3 px-1">
        <div className="flex flex-wrap items-center gap-2">
          {video.status === 'ready' ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-medium"
              title={copy.approx}
            >
              <Eye className="size-4" aria-hidden />
              {video.viewCount === 0
                ? copy.noViews
                : copy.views.replace('{count}', String(video.viewCount))}
            </span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-medium',
                failed && 'border-destructive/40 text-destructive',
              )}
            >
              {failed ? (
                <CircleAlert className="size-4" aria-hidden />
              ) : (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              )}
              {videoCopy.status[video.status]}
            </span>
          )}
        </div>
        {editing ? (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await renameVideoAction(locale, video.id, title);
                if (result.status === 'error') {
                  toast.error(result.message);
                  return;
                }
                setSavedTitle(title.trim());
                setEditing(false);
                toast.success(result.message);
              });
            }}
          >
            <Input
              aria-label={videoCopy.title}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setEditing(false);
              }}
              autoFocus
              required
              maxLength={120}
              disabled={pending}
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                type="button"
                onClick={() => setEditing(false)}
              >
                {copy.cancel}
              </Button>
              <Button size="sm" disabled={pending} type="submit">
                {copy.save}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-start gap-2">
            <h2 className="line-clamp-2 min-w-0 flex-1 font-semibold leading-snug break-words">
              {savedTitle ?? video.title}
            </h2>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="-mt-1.5 -mr-2 size-8 shrink-0 text-muted-foreground"
                  aria-label={copy.more}
                  disabled={pending}
                >
                  <Ellipsis className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={startRename}>
                  <Pencil aria-hidden />
                  {copy.rename}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={video.shareUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden />
                    {copy.open}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setConfirming(true)}
                >
                  <Trash2 aria-hidden />
                  {copy.delete}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {video.lastViewedAt && (
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" aria-hidden />
              {copy.lastViewed.replace(
                '{time}',
                relativeDate(video.lastViewedAt, locale, now),
              )}
            </span>
          )}
          {video.averageWatchedPercent !== null && (
            <span className="inline-flex items-center gap-1">
              <Gauge className="size-3.5" aria-hidden />
              {copy.avgWatched.replace(
                '{percent}',
                String(video.averageWatchedPercent),
              )}
            </span>
          )}
          {video.finishedViews > 0 && (
            <span className="inline-flex items-center gap-1">
              <CircleCheck className="size-3.5" aria-hidden />
              {copy.finishedBy.replace('{count}', String(video.finishedViews))}
            </span>
          )}
        </div>
        {video.failureReason && (
          <p className="text-sm text-destructive">
            {videoCopy.failure[video.failureReason]}
          </p>
        )}
        {!failed && (
          <Button
            className="mt-auto h-11 w-full rounded-xl text-base"
            onClick={() => void copyLink()}
            aria-live="polite"
          >
            {copied ? copy.copied : copy.copy}
            {copied ? <Check aria-hidden /> : <Link2 aria-hidden />}
          </Button>
        )}
      </div>
      {playing && (
        <VideoPlayerDialog
          video={video}
          title={savedTitle ?? video.title}
          locale={locale}
          copy={copy}
          shareCopy={shareCopy}
          onClose={() => setPlaying(false)}
        />
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{copy.cancel}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteVideoAction(locale, video.id);
                  if (result.status === 'error') {
                    toast.error(result.message);
                    return;
                  }
                  setConfirming(false);
                  setDeleted(true);
                  toast.success(result.message);
                })
              }
            >
              {copy.delete}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function relativeDate(value: string, locale: Locale, now: number): string {
  const seconds = Math.min(
    0,
    Math.round((new Date(value).getTime() - now) / 1000),
  );
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (seconds > -60) return formatter.format(seconds, 'second');
  if (seconds > -3600)
    return formatter.format(Math.round(seconds / 60), 'minute');
  if (seconds > -86400)
    return formatter.format(Math.round(seconds / 3600), 'hour');
  return formatter.format(Math.round(seconds / 86400), 'day');
}
