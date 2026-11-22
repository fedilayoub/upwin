import { useCallback, useEffect, useRef, useState } from "react";
import { usePanelReturn } from "@/hooks/use-panel-return";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Eye,
  Film,
  Gauge,
  Link2,
  LoaderCircle,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/i18n-context";
import { useAsyncAction } from "@/hooks/use-async-action";
import { ErrorNotice } from "@/components/shared/error-notice";
import { reportError } from "@/features/diagnostics/error-log";
import type { ErrorRecord } from "@/features/diagnostics/errors";
import { useAppUrl } from "@/features/connection/connection-context";
import type { Video, VideoListResponse } from "@/types/video";
import { recordingApi } from "../client";
import { formatDuration } from "./recording-panel";

/**
 * Recent videos as a carousel: the side panel is too narrow for a grid, and a long column buries
 * everything after the first card. One card at a time, the next one peeking in, swipe or arrows.
 */
export function VideoLibrary() {
  const { t } = useI18n();
  const appUrl = useAppUrl();
  const load = useCallback(
      () => recordingApi<VideoListResponse>("list", { limit: 10 }),
      [],
    ),
    action = useAsyncAction(load, { operation: "videos.list" });
  const [removed, setRemoved] = useState<string[]>([]);
  const [error, setError] = useState<ErrorRecord | null>(null);
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void action.execute();
  }, [action.execute]);
  // Videos deleted or renamed on the web while the panel stayed open drop out on return. The
  // list keeps its items while it reloads, so this never flashes the skeleton.
  usePanelReturn(() => void action.execute());
  const items = (action.data?.items ?? []).filter(
    (video) => !removed.includes(video.id),
  );
  const go = (next: number) => {
    const target = track.current?.children[next] as HTMLElement | undefined;
    if (!track.current || !target) return;
    track.current.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
  };
  const onScroll = () => {
    const node = track.current;
    const first = node?.children[0] as HTMLElement | undefined;
    if (!node || !first) return;
    const step = first.offsetWidth + 12;
    setIndex(
      Math.min(
        items.length - 1,
        Math.max(0, Math.round(node.scrollLeft / step)),
      ),
    );
  };
  return (
    <section
      className="space-y-3"
      aria-roledescription="carousel"
      aria-label={t("video.recent")}
    >
      <header className="flex items-center gap-2">
        <h2 className="font-semibold">{t("video.recent")}</h2>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {items.length}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {items.length > 1 && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={t("video.previous")}
                disabled={index === 0}
                onClick={() => go(index - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={t("video.next")}
                disabled={index >= items.length - 1}
                onClick={() => go(index + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </>
          )}
          <a
            className="ml-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
            href={`${appUrl}/videos`}
            target="_blank"
            rel="noreferrer"
          >
            {t("video.seeAll")}
          </a>
        </div>
      </header>
      {action.error ? (
        <ErrorNotice
          failure={action.failure}
          message={t("video.error.UNKNOWN")}
          onRetry={() => void action.execute()}
        />
      ) : error ? (
        <ErrorNotice failure={error} message={t("video.error.UNKNOWN")} />
      ) : null}
      {action.status === "loading" && !items.length && (
        <div aria-busy className="w-[85%] space-y-2 rounded-xl border p-0">
          <div className="aspect-video animate-pulse rounded-t-xl bg-muted" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
          <span className="sr-only">{t("video.loading")}</span>
        </div>
      )}
      {action.status !== "loading" && !items.length && !action.error && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          <Film className="size-6" aria-hidden />
          {t("video.empty")}
        </div>
      )}
      {items.length > 0 && (
        <>
          <div
            ref={track}
            onScroll={onScroll}
            className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((video, i) => (
              <VideoSlide
                key={video.id}
                video={video}
                single={items.length === 1}
                label={t("video.position", {
                  index: i + 1,
                  total: items.length,
                })}
                onDeleted={() => {
                  setRemoved((current) => [...current, video.id]);
                  setIndex((current) =>
                    Math.max(0, Math.min(current, items.length - 2)),
                  );
                }}
                onError={(cause, operation) =>
                  setError(reportError({ error: cause, operation }))
                }
              />
            ))}
          </div>
          {items.length > 1 && (
            <div className="flex justify-center gap-1.5" role="tablist">
              {items.map((video, i) => (
                <button
                  key={video.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={t("video.position", {
                    index: i + 1,
                    total: items.length,
                  })}
                  onClick={() => go(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index
                      ? "w-4 bg-primary"
                      : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70"
                  }`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function VideoSlide({
  video,
  single,
  label,
  onDeleted,
  onError,
}: {
  video: Video;
  single: boolean;
  label: string;
  onDeleted: () => void;
  onError: (cause: unknown, operation: string) => void;
}) {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const failed = video.status === "failed";
  const copy = () =>
    void navigator.clipboard
      .writeText(video.shareUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch((cause: unknown) => onError(cause, "videos.copyLink"));
  return (
    <article
      aria-roledescription="slide"
      aria-label={label}
      className={`group relative flex shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-card ${
        single ? "w-full" : "w-[85%]"
      }`}
    >
      <a
        href={video.shareUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`${t("video.play")}: ${video.title}`}
        className="relative block aspect-video overflow-hidden bg-muted"
      >
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground">
            <Film className="size-7" aria-hidden />
          </span>
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/30">
          <span className="grid size-10 scale-90 place-items-center rounded-full bg-white/95 text-zinc-900 opacity-0 shadow-lg transition-all group-hover:scale-100 group-hover:opacity-100">
            <Play className="size-4 translate-x-px fill-current" aria-hidden />
          </span>
        </span>
        {video.status !== "ready" && (
          <span
            className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white ${
              failed ? "bg-destructive/90" : "bg-black/70"
            }`}
          >
            {failed ? (
              <CircleAlert className="size-3" aria-hidden />
            ) : (
              <LoaderCircle className="size-3 animate-spin" aria-hidden />
            )}
            {t(`video.status.${video.status}`)}
          </span>
        )}
        {video.averageWatchedPercent !== null && (
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1 bg-black/40"
          >
            <span
              className="block h-full bg-primary"
              style={{ width: `${video.averageWatchedPercent}%` }}
            />
          </span>
        )}
        {video.durationMs !== null && (
          <span className="absolute right-2 bottom-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
            {formatDuration(video.durationMs)}
          </span>
        )}
      </a>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold">
          {video.title}
        </h3>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          <span
            className="inline-flex items-center gap-1"
            title={t("video.viewsHint")}
          >
            <Eye className="size-3" aria-hidden />
            {video.viewCount === 0
              ? t("video.noViews")
              : t("video.views", { count: video.viewCount })}
            {video.lastViewedAt &&
              ` · ${relativeTime(video.lastViewedAt, locale)}`}
          </span>
          {video.averageWatchedPercent !== null && (
            <span className="inline-flex items-center gap-1">
              <Gauge className="size-3" aria-hidden />
              {t("video.avgWatched", { percent: video.averageWatchedPercent })}
            </span>
          )}
          {video.finishedViews > 0 && (
            <span className="inline-flex items-center gap-1">
              <CircleCheck className="size-3" aria-hidden />
              {t("video.finishedBy", { count: video.finishedViews })}
            </span>
          )}
        </div>
        <div className="mt-auto flex gap-1.5 pt-1">
          {!failed && (
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={copy}
            >
              {copied ? (
                <Check className="size-3.5 text-primary" aria-hidden />
              ) : (
                <Link2 className="size-3.5" aria-hidden />
              )}
              {copied ? t("video.copiedShort") : t("video.copyLink")}
            </Button>
          )}
          {!failed && (
            <Button size="icon" variant="outline" className="size-8" asChild>
              <a
                href={video.shareUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={t("video.open")}
                title={t("video.open")}
              >
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          )}
          <Button
            size="icon"
            variant="outline"
            className={`size-8 text-muted-foreground hover:text-destructive ${failed ? "ml-auto" : ""}`}
            aria-label={t("video.delete")}
            title={t("video.delete")}
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      {confirming && (
        <div
          role="alertdialog"
          aria-label={t("video.confirmDelete")}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 p-4 text-center backdrop-blur-sm"
        >
          <p className="text-sm font-medium">{t("video.confirmDelete")}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={deleting}
              onClick={() => setConfirming(false)}
            >
              {t("video.cancel")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                setDeleting(true);
                void recordingApi("remove", { videoId: video.id })
                  .then(onDeleted)
                  .catch((cause: unknown) => {
                    setDeleting(false);
                    setConfirming(false);
                    onError(cause, "videos.remove");
                  });
              }}
            >
              {t("video.delete")}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function relativeTime(value: string, locale: string): string {
  const seconds = Math.min(
    0,
    Math.round((new Date(value).getTime() - Date.now()) / 1000),
  );
  const format = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
    style: "short",
  });
  if (seconds > -60) return format.format(seconds, "second");
  if (seconds > -3600) return format.format(Math.round(seconds / 60), "minute");
  if (seconds > -86400)
    return format.format(Math.round(seconds / 3600), "hour");
  return format.format(Math.round(seconds / 86400), "day");
}
