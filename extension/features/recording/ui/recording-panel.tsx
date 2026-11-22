import { useEffect, useState, type ReactNode } from "react";
import {
  Camera,
  CameraOff,
  Keyboard,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/i18n-context";
import type { SessionState } from "../protocol";
import { sendRecording } from "../client";
import { useRecordingShortcut } from "../hooks/use-recording-shortcut";
export function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
type Command = "pause" | "resume" | "stop" | "restart" | "cancel";

/** The live take, mirrored in the side panel: time, controls, inputs and upload health. */
export function RecordingPanel({ state }: { state: SessionState }) {
  const { t } = useI18n();
  const shortcut = useRecordingShortcut();
  const [now, setNow] = useState(Date.now()),
    [confirm, setConfirm] = useState<"cancel" | "restart" | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const max = state.maxDurationMs ?? Infinity;
  const elapsed = Math.min(
    max,
    state.elapsedMs +
      (state.phase === "recording" ? Math.max(0, now - state.updatedAt) : 0),
  );
  const paused = state.phase === "paused";
  const nearLimit = elapsed >= max - 30_000;
  const share = Number.isFinite(max) && max > 0 ? (elapsed / max) * 100 : 0;
  const command = (type: Command) => {
    void sendRecording({ target: "background", type: `recording/${type}` });
  };
  const live = (update: { micMuted?: boolean; cameraVisible?: boolean }) =>
    void sendRecording({
      target: "background",
      type: "recording/live",
      update,
    });
  const micOn = !state.live.micMuted;
  const cameraOn = state.live.cameraVisible;
  return (
    <section className="relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs">
      <header className="flex items-center justify-between gap-2 px-4 pt-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${
            paused
              ? "bg-warning/15 text-warning-foreground"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${paused ? "bg-warning" : "animate-pulse bg-red-500"}`}
          />
          {t(paused ? "video.pausedLabel" : "video.recordingLabel")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${state.uploadHealthy ? "bg-success" : "animate-pulse bg-warning"}`}
          />
          {t(state.uploadHealthy ? "video.connected" : "video.reconnecting")}
        </span>
      </header>

      <div className="px-4 pt-3">
        <p
          role="timer"
          className={`text-4xl font-semibold tracking-tight tabular-nums ${nearLimit ? "text-warning-foreground" : ""}`}
        >
          {formatDuration(elapsed)}
          <span className="ml-1.5 text-base font-medium text-muted-foreground">
            / {formatDuration(state.maxDurationMs ?? 0)}
          </span>
        </p>
        <div
          aria-hidden
          className="mt-3 h-1 overflow-hidden rounded-full bg-foreground/10"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${
              nearLimit
                ? "bg-warning"
                : paused
                  ? "bg-muted-foreground"
                  : "bg-red-500"
            }`}
            style={{ width: `${share}%` }}
          />
        </div>
        {nearLimit && (
          <p className="mt-2 text-xs text-warning-foreground">
            {t("video.stopsAt", {
              duration: formatDuration(state.maxDurationMs ?? 0),
            })}
          </p>
        )}
      </div>

      <div className="flex gap-2 p-4">
        <Button className="h-10 flex-1 gap-2" onClick={() => command("stop")}>
          <Square className="size-3.5 fill-current" aria-hidden />
          {t("video.finish")}
        </Button>
        <IconAction
          label={t(paused ? "video.resume" : "video.pause")}
          onClick={() => command(paused ? "resume" : "pause")}
        >
          {paused ? (
            <Play className="size-4 fill-current" />
          ) : (
            <Pause className="size-4 fill-current" />
          )}
        </IconAction>
        <IconAction
          label={t("video.restart")}
          onClick={() => setConfirm("restart")}
        >
          <RotateCcw className="size-4" />
        </IconAction>
        <IconAction
          label={t("video.discard")}
          danger
          onClick={() => setConfirm("cancel")}
        >
          <Trash2 className="size-4" />
        </IconAction>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        <Toggle
          on={micOn}
          label={t(micOn ? "video.mute" : "video.unmute")}
          onClick={() => live({ micMuted: micOn })}
          icon={
            micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />
          }
        >
          {t("video.mic")}
        </Toggle>
        <Toggle
          on={cameraOn}
          label={t(cameraOn ? "video.hideCamera" : "video.showCamera")}
          onClick={() => live({ cameraVisible: !cameraOn })}
          icon={
            cameraOn ? (
              <Camera className="size-4" />
            ) : (
              <CameraOff className="size-4" />
            )
          }
        >
          {t("video.camera")}
        </Toggle>
      </div>

      {state.warnings
        .filter((w) => w !== "limit")
        .map((w) => (
          <p
            role="status"
            key={w}
            className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground"
          >
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            {t(`video.warning.${w}`)}
          </p>
        ))}

      {shortcut && (
        <footer className="flex items-center gap-2 border-t bg-muted/40 px-4 py-2.5 text-[11px] text-muted-foreground">
          <Keyboard className="size-3.5" aria-hidden />
          {t("video.shortcut", { keys: shortcut })}
        </footer>
      )}

      {confirm && (
        <div
          role="alertdialog"
          aria-label={t(
            confirm === "restart"
              ? "video.confirmRestart"
              : "video.confirmDiscard",
          )}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/95 p-5 text-center backdrop-blur-sm"
        >
          <span
            className={`grid size-10 place-items-center rounded-full ${confirm === "cancel" ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground"}`}
          >
            {confirm === "cancel" ? (
              <Trash2 className="size-4" aria-hidden />
            ) : (
              <RotateCcw className="size-4" aria-hidden />
            )}
          </span>
          <p className="text-sm font-medium">
            {t(
              confirm === "restart"
                ? "video.confirmRestart"
                : "video.confirmDiscard",
            )}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirm(null)}
            >
              {t("video.keepRecording")}
            </Button>
            <Button
              size="sm"
              variant={confirm === "cancel" ? "destructive" : "default"}
              onClick={() => {
                command(confirm);
                setConfirm(null);
              }}
            >
              {t(confirm === "cancel" ? "video.discard" : "video.restart")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function IconAction({
  label,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`size-10 shrink-0 ${danger ? "text-muted-foreground hover:text-destructive" : ""}`}
    >
      {children}
    </Button>
  );
}

function Toggle({
  on,
  label,
  icon,
  onClick,
  children,
}: {
  on: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        on
          ? "bg-secondary text-foreground hover:bg-secondary/70"
          : "border-dashed text-muted-foreground hover:text-foreground"
      }`}
    >
      <span aria-hidden className={on ? "text-primary" : ""}>
        {icon}
      </span>
      <span className="flex-1 text-left">{children}</span>
      <span
        aria-hidden
        className={`relative h-4 w-7 rounded-full transition-colors ${on ? "bg-primary" : "bg-foreground/15"}`}
      >
        <span
          className={`absolute top-0.5 size-3 rounded-full bg-background shadow-sm transition-[left] duration-200 ${on ? "left-3.5" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}
