import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CircleAlert,
  CircleCheck,
  ClipboardCopy,
  Film,
  Link2,
  LoaderCircle,
  RotateCcw,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/i18n-context";
import { useAsyncAction } from "@/hooks/use-async-action";
import { ErrorReference } from "@/components/shared/error-notice";
import { reportError } from "@/features/diagnostics/error-log";
import type { ErrorRecord } from "@/features/diagnostics/errors";
import type { VideoListResponse } from "@/types/video";
import { recordingApi } from "../client";
import { isRecordingSupported } from "../support";
import { formatDuration } from "./recording-panel";
import type { VideoIntent } from "./new-recording";
export function ProposalVideo({
  jobSnapshotId,
  jobTitle,
  proposalText,
  onRecord,
}: {
  jobSnapshotId: string;
  jobTitle: string;
  proposalText: string;
  onRecord: (intent: VideoIntent) => void;
}) {
  return isRecordingSupported() ? (
    <SupportedProposalVideo
      jobSnapshotId={jobSnapshotId}
      jobTitle={jobTitle}
      proposalText={proposalText}
      onRecord={onRecord}
    />
  ) : null;
}
export function SupportedProposalVideo({
  jobSnapshotId,
  jobTitle,
  proposalText,
  onRecord,
}: {
  jobSnapshotId: string;
  jobTitle: string;
  proposalText: string;
  onRecord: (intent: VideoIntent) => void;
}) {
  const { t } = useI18n(),
    [error, setError] = useState<ErrorRecord | null>(null),
    [copied, setCopied] = useState<"link" | "proposal" | null>(null);
  const load = useCallback(
      () =>
        recordingApi<VideoListResponse>("list", { jobSnapshotId, limit: 1 }),
      [jobSnapshotId],
    ),
    action = useAsyncAction(load, { operation: "videos.list" });
  useEffect(() => {
    void action.execute();
  }, [action.execute]);
  const video = action.data?.items[0];
  const copy = (proposal: boolean) => {
    if (!video) return;
    const sentence = t("video.copySentence", {
      duration: formatDuration(video.durationMs ?? 0),
      url: video.shareUrl,
    });
    void navigator.clipboard
      .writeText(proposal ? `${proposalText}\n\n${sentence}` : video.shareUrl)
      .then(() => {
        const kind = proposal ? "proposal" : "link";
        setCopied(kind);
        setTimeout(
          () => setCopied((current) => (current === kind ? null : current)),
          1800,
        );
      })
      .catch((cause: unknown) =>
        setError(reportError({ error: cause, operation: "videos.copyLink" })),
      );
  };
  const record = () =>
    onRecord({
      jobSnapshotId,
      title: t("video.forJob", { title: jobTitle.slice(0, 115) }).slice(0, 120),
    });
  return (
    <div className="pt-3">
      {video ? (
        <div className="rounded-xl border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="relative grid h-10 w-16 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <Film className="size-4" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{video.title}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {video.status === "ready" ? (
                  <CircleCheck className="size-3 text-primary" aria-hidden />
                ) : video.status === "failed" ? (
                  <CircleAlert
                    className="size-3 text-destructive"
                    aria-hidden
                  />
                ) : (
                  <LoaderCircle className="size-3 animate-spin" aria-hidden />
                )}
                {t(`video.status.${video.status}`)}
                {video.durationMs !== null &&
                  ` · ${formatDuration(video.durationMs)}`}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0 text-muted-foreground"
              aria-label={t("video.another")}
              title={t("video.another")}
              onClick={record}
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
          <div className="mt-3 flex flex-col-reverse gap-2">
            <Button size="sm" variant="outline" onClick={() => copy(false)}>
              {copied === "link" ? (
                <Check className="size-3.5 text-primary" aria-hidden />
              ) : (
                <Link2 className="size-3.5" aria-hidden />
              )}
              {copied === "link" ? t("video.copiedShort") : t("video.copyLink")}
            </Button>
            <Button size="sm" onClick={() => copy(true)}>
              {copied === "proposal" ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <ClipboardCopy className="size-3.5" aria-hidden />
              )}
              <span className="truncate">
                {copied === "proposal"
                  ? t("video.copiedShort")
                  : t("video.copyProposalVideo")}
              </span>
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={record}
          className="group flex w-full items-center gap-3 rounded-xl border border-dashed bg-card/50 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Video className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              {t("video.recordForJob")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("video.recordForJobHint")}
            </span>
          </span>
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full bg-red-500 ring-[3px] ring-red-500/25"
          />
        </button>
      )}
      <p role="status" className="sr-only">
        {copied ? t("video.copied") : ""}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {t("video.error.UNKNOWN")}{" "}
          <ErrorReference failure={error} />
        </p>
      )}
    </div>
  );
}
