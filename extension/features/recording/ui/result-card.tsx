import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Film,
  Link2,
  LoaderCircle,
  MessageSquareQuote,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/i18n-context";
import type { Video } from "@/types/video";
import { usePanelReturn } from "@/hooks/use-panel-return";
import { isVideoGone, recordingApi } from "../client";
import { formatDuration } from "./recording-panel";

type Copied = "link" | "sentence" | null;

/**
 * The video just recorded: its link first (that is what goes into the proposal), the title
 * editable in place, and the rarer actions in a footer.
 */
export function ResultCard({
  videoId,
  shareUrl,
  elapsedMs,
  onAnother,
  processing = false,
}: {
  videoId: string;
  shareUrl: string;
  elapsedMs: number;
  onAnother?: () => void;
  processing?: boolean;
}) {
  const { t } = useI18n();
  const [video, setVideo] = useState<Video | null>(null),
    [title, setTitle] = useState(""),
    [titleState, setTitleState] = useState<"idle" | "saving" | "saved">("idle"),
    [confirm, setConfirm] = useState(false),
    [deleting, setDeleting] = useState(false),
    [error, setError] = useState(false),
    [copied, setCopied] = useState<Copied>(null),
    [deleted, setDeleted] = useState(false),
    // Bumped when the user comes back to the panel: the video may have been renamed, finished
    // processing or been deleted on the web meanwhile.
    [visit, setVisit] = useState(0);
  const cancelEdit = useRef(false);
  usePanelReturn(() => setVisit((current) => current + 1));
  useEffect(() => {
    if (deleted) return;
    let alive = true,
      timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const poll = async () => {
      try {
        const { video } = await recordingApi<{ video: Video }>("get", {
          videoId,
        });
        if (!alive) return;
        setVideo(video);
        setTitle((current) => current || video.title);
        if (["ready", "failed"].includes(video.status)) return;
      } catch (cause: unknown) {
        if (!alive) return;
        // Deleted elsewhere: say so instead of spinning on a video that will never load.
        if (isVideoGone(cause)) {
          setDeleted(true);
          return;
        }
        setError(true);
      }
      if (alive && Date.now() - started < 120_000)
        timer = setTimeout(() => void poll(), 3000);
    };
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [videoId, visit, deleted]);

  const status = video?.status ?? (processing ? "processing" : "uploading");
  const ready = status === "ready";
  const failed = status === "failed";
  const duration = formatDuration(video?.durationMs ?? elapsedMs);

  const copy = (kind: Exclude<Copied, null>) => {
    setError(false);
    void navigator.clipboard
      .writeText(
        kind === "sentence"
          ? t("video.copySentence", { duration, url: shareUrl })
          : shareUrl,
      )
      .then(() => {
        setCopied(kind);
        setTimeout(
          () => setCopied((current) => (current === kind ? null : current)),
          1800,
        );
      })
      .catch(() => setError(true));
  };
  const saveTitle = () => {
    if (cancelEdit.current) {
      cancelEdit.current = false;
      return;
    }
    const next = title.trim();
    if (!next) {
      setTitle(video?.title ?? "");
      return;
    }
    if (next === video?.title) return;
    setError(false);
    setTitleState("saving");
    void recordingApi<{ video: Video }>("rename", { videoId, title: next })
      .then((response) => {
        setVideo(response.video);
        setTitle(response.video.title);
        setTitleState("saved");
        setTimeout(
          () =>
            setTitleState((current) =>
              current === "saved" ? "idle" : current,
            ),
          1800,
        );
      })
      .catch((cause: unknown) => {
        setTitleState("idle");
        if (isVideoGone(cause)) setDeleted(true);
        else setError(true);
      });
  };
  const remove = () => {
    setDeleting(true);
    setError(false);
    void recordingApi("remove", { videoId })
      .then(() => setDeleted(true))
      .catch((cause: unknown) => {
        // Already deleted elsewhere: the outcome the user asked for.
        if (isVideoGone(cause)) {
          setDeleted(true);
          return;
        }
        setDeleting(false);
        setConfirm(false);
        setError(true);
      });
  };

  if (deleted)
    return (
      <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        <Trash2 className="size-5" aria-hidden />
        <p role="status">{t("video.deleted")}</p>
        {onAnother && (
          <Button size="sm" variant="outline" onClick={onAnother}>
            <Plus className="size-3.5" aria-hidden />
            {t("video.another")}
          </Button>
        )}
      </section>
    );

  return (
    <section className="relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs">
      <Thumbnail href={ready ? shareUrl : null} label={t("video.play")}>
        {video?.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground">
            {failed ? (
              <Film className="size-7" aria-hidden />
            ) : (
              <LoaderCircle className="size-6 animate-spin" aria-hidden />
            )}
          </span>
        )}
        <span className="absolute right-2 bottom-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
          {duration}
        </span>
      </Thumbnail>

      <div className="space-y-3 p-3">
        <div>
          <div className="relative">
            <input
              aria-label={t("video.title")}
              title={t("video.editTitle")}
              className="peer -mx-2 h-8 w-[calc(100%+1rem)] min-w-0 truncate rounded-md border border-transparent bg-transparent px-2 pr-8 text-sm font-semibold outline-none transition-colors hover:border-input focus:border-input focus:bg-background focus-visible:ring-2 focus-visible:ring-ring/30"
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  cancelEdit.current = true;
                  setTitle(video?.title ?? title);
                  event.currentTarget.blur();
                }
              }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 text-muted-foreground peer-focus:opacity-0"
            >
              {titleState === "saving" ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : titleState === "saved" ? (
                <Check className="size-3.5 text-primary" />
              ) : (
                <Pencil className="size-3.5 opacity-60" />
              )}
            </span>
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {ready ? (
              <CircleCheck className="size-3.5 text-primary" aria-hidden />
            ) : failed ? (
              <CircleAlert className="size-3.5 text-destructive" aria-hidden />
            ) : (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            )}
            {ready ? t("video.ready") : t(`video.status.${status}`)}
          </p>
        </div>

        {!failed && (
          <>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 pl-2.5">
              <Link2
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <input
                aria-label={t("video.link")}
                className="min-w-0 flex-1 truncate bg-transparent text-xs text-muted-foreground outline-none"
                readOnly
                value={shareUrl}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                size="sm"
                className="h-7 shrink-0 px-2.5 text-xs"
                onClick={() => copy("link")}
              >
                {copied === "link" ? (
                  <Check className="size-3.5" aria-hidden />
                ) : null}
                {copied === "link"
                  ? t("video.copiedShort")
                  : t("video.copyLink")}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy("sentence")}
              >
                {copied === "sentence" ? (
                  <Check className="size-3.5 text-primary" aria-hidden />
                ) : (
                  <MessageSquareQuote className="size-3.5" aria-hidden />
                )}
                {copied === "sentence"
                  ? t("video.copiedShort")
                  : t("video.copySentenceAction")}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" aria-hidden />
                  {t("video.open")}
                </a>
              </Button>
            </div>
          </>
        )}

        {(error || failed) && (
          <p role="alert" className="text-xs text-destructive">
            {t(failed ? "video.processingFailed" : "video.error.UNKNOWN")}
          </p>
        )}

        <div className="flex items-center gap-2 border-t pt-2.5">
          {onAnother && (
            <Button
              size="sm"
              variant="ghost"
              className="-ml-2 text-muted-foreground hover:text-foreground"
              onClick={onAnother}
            >
              <Plus className="size-3.5" aria-hidden />
              {t("video.another")}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="-mr-1 ml-auto size-8 text-muted-foreground hover:text-destructive"
            aria-label={t("video.delete")}
            title={t("video.delete")}
            disabled={!video || video.status === "uploading"}
            onClick={() => setConfirm(true)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <p role="status" className="sr-only">
        {copied
          ? t("video.copied")
          : titleState === "saved"
            ? t("video.titleSaved")
            : ""}
      </p>

      {confirm && (
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
              onClick={() => setConfirm(false)}
            >
              {t("video.cancel")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={deleting}
              onClick={remove}
            >
              {t("video.delete")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Thumbnail({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: ReactNode;
}) {
  const className =
    "group relative block aspect-video overflow-hidden bg-muted";
  if (!href) return <div className={className}>{children}</div>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className={className}
    >
      {children}
      <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/30">
        <span className="grid size-10 scale-90 place-items-center rounded-full bg-white/95 text-zinc-900 opacity-0 shadow-lg transition-all group-hover:scale-100 group-hover:opacity-100">
          <Play className="size-4 translate-x-px fill-current" aria-hidden />
        </span>
      </span>
    </a>
  );
}
