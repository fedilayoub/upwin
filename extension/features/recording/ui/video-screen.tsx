import { formatBytes } from "./format-bytes";
import { useEffect, useState } from "react";
import {
  CircleAlert,
  CloudUpload,
  LoaderCircle,
  MonitorX,
  Sparkles,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/shared/page-heading";
import { ErrorNotice, ErrorReference } from "@/components/shared/error-notice";
import type { ErrorRecord } from "@/features/diagnostics/errors";
import { useI18n } from "@/features/i18n/i18n-context";
import type { TranslationKey } from "@/features/i18n/dictionaries/en";
import { en } from "@/features/i18n/dictionaries/en";
import { useRecordingState } from "../hooks/use-recording-state";
import { useVideoLimits } from "../hooks/use-video-limits";
import { isRecordingSupported } from "../support";
import { sendRecording } from "../client";
import { NewRecording, type VideoIntent } from "./new-recording";
import { RecordingPanel } from "./recording-panel";
import { ResultCard } from "./result-card";
import { RecoveryBanner } from "./recovery-banner";
import { VideoLibrary } from "./video-library";
export function VideoScreen({ intent }: { intent?: VideoIntent | null }) {
  return isRecordingSupported() ? (
    <SupportedVideoScreen intent={intent} />
  ) : (
    <UnsupportedVideo />
  );
}
function UnsupportedVideo() {
  const { t } = useI18n();
  return (
    <Notice icon={<MonitorX className="size-5" aria-hidden />}>
      {t("video.unsupported")}
    </Notice>
  );
}
/** A quiet, centred state card: unsupported browser, coming soon. */
function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
      <span className="grid size-10 place-items-center rounded-full bg-secondary text-foreground">
        {icon}
      </span>
      <p className="max-w-[32ch]">{children}</p>
    </div>
  );
}
/** The worker reported an engine failure under `ref`; this is its local view. */
function engineFailure(code: string, ref: string): ErrorRecord {
  return {
    id: ref,
    ref,
    occurredAt: new Date().toISOString(),
    surface: "offscreen",
    code,
    operation: "recording.engine",
  };
}
export function SupportedVideoScreen({
  intent,
}: {
  intent?: VideoIntent | null;
}) {
  const { t, locale } = useI18n(),
    state = useRecordingState(),
    limits = useVideoLimits();
  const [another, setAnother] = useState(false);
  useEffect(() => {
    if (state.phase !== "done") setAnother(false);
  }, [state.phase]);
  const idle =
    state.phase === "idle" ||
    (state.phase === "done" && another) ||
    (state.phase === "failed" && !state.recoveries.length);
  const errorKey =
    state.error?.messageKey && state.error.messageKey in en
      ? (state.error.messageKey as TranslationKey)
      : "video.error.UNKNOWN";
  return (
    <div className="space-y-4">
      <PageHeading
        icon={Video}
        title={t("video.nav")}
        description={t("video.description")}
      />
      {["idle", "failed", "done"].includes(state.phase) && (
        <RecoveryBanner sessions={state.recoveries} />
      )}
      {state.phase === "failed" && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
        >
          <p className="flex items-start gap-2.5">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t(errorKey)}
          </p>
          {state.error?.ref ? (
            <ErrorReference
              className="mt-2 pl-6.5"
              failure={engineFailure(state.error.code, state.error.ref)}
            />
          ) : null}
        </div>
      )}
      {idle &&
        !state.recoveries.length &&
        (limits.data ? (
          limits.data.available ? (
            <>
              <NewRecording limits={limits.data} intent={intent} />
              <VideoLibrary />
            </>
          ) : (
            <Notice icon={<Sparkles className="size-5" aria-hidden />}>
              {t("video.comingSoon")}
            </Notice>
          )
        ) : limits.error ? (
          <ErrorNotice
            failure={limits.failure}
            message={t("video.error.UNKNOWN")}
            onRetry={() => void limits.execute()}
          />
        ) : (
          <div
            role="status"
            aria-busy
            className="space-y-3 rounded-xl border p-4"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-md" />
            <span className="sr-only">{t("video.loading")}</span>
          </div>
        ))}
      {[
        "acquiring",
        "picking",
        "selecting-area",
        "creating",
        "countdown",
      ].includes(state.phase) && (
        <section className="flex flex-col items-center gap-4 rounded-xl border bg-card px-4 py-7 text-center shadow-xs">
          <p role="status" className="flex flex-col items-center gap-3">
            {state.phase === "countdown" ? (
              <>
                <span className="relative grid size-20 place-items-center">
                  <span
                    aria-hidden
                    className="absolute inset-0 animate-ping rounded-full bg-primary/15 [animation-duration:1s]"
                  />
                  <span className="relative grid size-20 place-items-center rounded-full border-4 border-primary/20 bg-background text-4xl font-semibold tabular-nums">
                    {state.countdown}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {t("video.getReady")}
                </span>
              </>
            ) : (
              <>
                <LoaderCircle
                  className="size-7 animate-spin text-primary"
                  aria-hidden
                />
                <span className="text-sm text-muted-foreground">
                  {t(
                    state.phase === "picking"
                      ? "video.chooseShare"
                      : "video.starting",
                  )}
                </span>
              </>
            )}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() =>
              void sendRecording({
                target: "background",
                type: "recording/cancel",
              })
            }
          >
            {t("video.cancel")}
          </Button>
        </section>
      )}
      {["recording", "paused"].includes(state.phase) && (
        <RecordingPanel state={state} />
      )}
      {["stopping", "uploading", "completing"].includes(state.phase) && (
        <section className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <CloudUpload className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t("video.uploading")}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("video.uploadedOf", {
                  done: formatBytes(state.bytesUploaded, locale),
                  total: formatBytes(state.bytesRecorded, locale),
                })}
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums">
              {Math.round(
                (state.bytesUploaded / Math.max(1, state.bytesRecorded)) * 100,
              )}
              %
            </span>
          </div>
          <Progress
            label={t("video.uploading")}
            value={
              (state.bytesUploaded / Math.max(1, state.bytesRecorded)) * 100
            }
          />
        </section>
      )}
      {state.videoId &&
        state.shareUrl &&
        (["stopping", "uploading", "completing"].includes(state.phase) ||
          (state.phase === "done" && !another)) && (
          <ResultCard
            key={state.videoId}
            videoId={state.videoId}
            shareUrl={state.shareUrl}
            elapsedMs={state.elapsedMs}
            processing={state.phase === "done"}
            onAnother={
              state.phase === "done"
                ? () => {
                    setAnother(true);
                    void limits.execute();
                  }
                : undefined
            }
          />
        )}
    </div>
  );
}
