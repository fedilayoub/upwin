import { formatBytes } from "./format-bytes";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { browser } from "wxt/browser";
import {
  AppWindow,
  Check,
  ChevronUp,
  Copy,
  ExternalLink,
  Infinity as InfinityIcon,
  LoaderCircle,
  Mic,
  MicOff,
  Monitor,
  PanelTop,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scan,
  Square,
  Trash2,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from "lucide-react";
import { BackgroundBlur } from "./icons";
import { BrandThinkingOrb } from "@/components/shared/brand-thinking-orb";
import { useI18n } from "@/features/i18n/i18n-context";
import { en, type TranslationKey } from "@/features/i18n/dictionaries/en";
import { sendRecording } from "../client";
import { useRecordingState } from "../hooks/use-recording-state";
import { useVideoLimits } from "../hooks/use-video-limits";
import { usePreview } from "../hooks/use-preview";
import { useBarPreferences } from "../hooks/use-bar-preferences";
import { useTabCapture } from "../hooks/use-tab-capture";
import {
  intentSchema,
  type MediaDevice,
  type RecorderIntent,
  type RecordingMode,
  type SessionState,
} from "../protocol";
import { errorCode } from "../engine/host";
import type { VideoLimits } from "@/types/video";
import { revealWidths } from "../host-layout";
import { reportError } from "@/features/diagnostics/error-log";
import { copyInFrame } from "./clipboard";

export function formatClock(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
/** The preferred device if still present, else the system default, else the first. */
export function pickDevice(id: string | null, devices: MediaDevice[]) {
  if (id && devices.some((d) => d.deviceId === id)) return id;
  return (
    devices.find((d) => d.deviceId === "default")?.deviceId ??
    devices[0]?.deviceId ??
    null
  );
}
export type BarStage =
  "setup" | "starting" | "recording" | "uploading" | "done";
export function stageFor(state: SessionState): BarStage {
  switch (state.phase) {
    case "acquiring":
    case "picking":
    case "selecting-area":
    case "creating":
    case "countdown":
      return "starting";
    case "recording":
    case "paused":
      return "recording";
    case "stopping":
    case "uploading":
    case "completing":
      return "uploading";
    case "done":
      return "done";
    default:
      return "setup";
  }
}
/** Mounted while open, and for one exit animation after closing. */
function usePresence(open: boolean, ms = 160) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(timer);
  }, [open, ms]);
  return { mounted, shown };
}
const MODES: { mode: RecordingMode; icon: LucideIcon; key: TranslationKey }[] =
  [
    { mode: "tab", icon: PanelTop, key: "video.mode.tab" },
    { mode: "window", icon: AppWindow, key: "video.mode.window" },
    { mode: "screen", icon: Monitor, key: "video.mode.screen" },
    { mode: "area", icon: Scan, key: "video.mode.area" },
  ];

/**
 * The in-page recorder bar. Rendered in an extension frame on the page, or full-page in
 * the fallback recorder tab. It holds no media: devices and levels come from the offscreen
 * preview, and all commands go through the worker.
 */
export function RecorderBar({
  embedded,
  fallback = false,
}: {
  embedded: boolean;
  fallback?: boolean;
}) {
  const { t, locale } = useI18n();
  const state = useRecordingState("recorder");
  const limits = useVideoLimits();
  const { snapshot, level, blur: blurStatus, blurReason } = usePreview();
  const { preferences, update, loaded } = useBarPreferences();
  const tabCapture = useTabCapture();
  const [intent, setIntent] = useState<RecorderIntent | null>(null);
  /** What opens above the setup row: a device list, or the plan usage the user asked to see. */
  const [menu, setMenu] = useState<"camera" | "microphone" | "usage" | null>(
    null,
  );
  const [lastMenu, setLastMenu] = useState<"camera" | "microphone" | "usage">(
    "camera",
  );
  const [confirm, setConfirm] = useState<"restart" | "cancel" | null>(null);
  const [copied, setCopied] = useState(false);
  /** Every copy path failed: the done row shows the link selected for ⌘C. */
  const [copyFailed, setCopyFailed] = useState(false);
  const [notice, setNotice] = useState<TranslationKey | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menuPresence = usePresence(menu !== null);

  const modes = fallback
    ? MODES.filter((m) => m.mode === "window" || m.mode === "screen")
    : MODES;
  const mode = modes.some((m) => m.mode === preferences.mode)
    ? preferences.mode
    : (modes[0]?.mode ?? "screen");
  const cameras =
    snapshot?.devices.filter((d) => d.kind === "videoinput") ?? [];
  const mics = snapshot?.devices.filter((d) => d.kind === "audioinput") ?? [];
  const camera = pickDevice(preferences.cameraDeviceId, cameras);
  const mic = pickDevice(preferences.micDeviceId, mics);
  const stage = stageFor(state);

  useEffect(() => {
    void browser.storage.session
      .get("recording.intent")
      .then((value) => {
        const parsed = intentSchema.safeParse(value["recording.intent"]);
        setIntent(parsed.success ? parsed.data : null);
      })
      .catch(() => undefined);
  }, []);

  // Previews follow the toggles: camera while setting up or recording, mic only while setting up.
  const previewing =
    stage === "setup" || stage === "starting" || stage === "recording";
  const cameraPreview =
    loaded && previewing && preferences.cameraOn ? camera : null;
  const micPreview =
    loaded && stage === "setup" && preferences.micOn ? mic : null;
  useEffect(() => {
    if (!loaded) return;
    void sendRecording({
      target: "background",
      type: "recorder/preview",
      cameraDeviceId: cameraPreview,
      micDeviceId: micPreview,
      mode,
      blur: preferences.blur,
    }).catch(() => undefined);
  }, [loaded, cameraPreview, micPreview, mode, preferences.blur]);

  useEffect(() => {
    if (stage !== "recording") setConfirm(null);
    if (stage === "setup") {
      setCopied(false);
      setCopyFailed(false);
    }
    if (stage !== "setup") setMenu(null);
  }, [stage]);
  useEffect(() => {
    if (menu) setLastMenu(menu);
  }, [menu]);

  // Tell the page host how big this frame should be: the content's own size, never the frame's.
  useLayoutEffect(() => {
    if (!embedded || !root.current) return;
    const element = root.current;
    const report = () =>
      window.parent.postMessage(
        {
          type: "upwin-recorder:size",
          w: element.offsetWidth,
          h: element.offsetHeight,
          ...measureReveal(element),
        },
        "*",
      );
    const observer = new ResizeObserver(report);
    observer.observe(element);
    report();
    return () => observer.disconnect();
  }, [embedded]);

  const command = (
    type: "pause" | "resume" | "stop" | "restart" | "cancel" | "reset",
  ) => void sendRecording({ target: "background", type: `recording/${type}` });
  const close = () =>
    void sendRecording({ target: "background", type: "recorder/close" }).then(
      () => {
        if (!embedded) window.close();
      },
    );
  const openTab = (url: string) => void browser.tabs.create({ url });
  const copyText = (url: string) => {
    setCopyFailed(false);
    // First, inside the click and before any await: a strict page Permissions-Policy blocks
    // navigator.clipboard in this frame, but not this (see ./clipboard.ts).
    if (copyInFrame(url)) {
      setCopied(true);
      return;
    }
    void navigator.clipboard
      .writeText(url)
      .then(() => setCopied(true))
      .catch(async (cause: unknown) => {
        // Last resort: the offscreen document. Measured unreliable right after it is created.
        const result: unknown = await browser.runtime
          .sendMessage({
            target: "background",
            type: "recorder/copy",
            text: url,
          })
          .catch(() => null);
        const ok =
          typeof result === "object" &&
          result !== null &&
          "ok" in result &&
          result.ok === true;
        setCopied(ok);
        if (ok) return;
        setCopyFailed(true);
        reportError({
          error: cause,
          code: "CLIPBOARD_FAILED",
          operation: "recorder.copyLink",
        });
      });
  };

  async function start() {
    setNotice(null);
    setMenu(null);
    if ((mode === "tab" || mode === "area") && !fallback) {
      if (captureStatus === "missing") {
        // First await in the click, so Chrome sees the gesture.
        await tabCapture.request();
        // Area needs the grant and then one toolbar click; the setup row says which comes next.
        // This tab records through the browser's picker meanwhile.
        if (mode === "area") return;
      } else if (mode === "area" && captureStatus === "needs-click") return;
    }
    await sendRecording({
      target: "background",
      type: "recording/start",
      settings: {
        mode,
        cameraDeviceId: preferences.cameraOn ? camera : null,
        micDeviceId: preferences.micOn ? mic : null,
        cameraVisible: preferences.cameraOn && !!camera,
        bubbleCorner: "bottom-right",
        bubbleSize: "md",
        bubbleRoundness: 1,
        bubbleZoom: 1,
        includeDisplayAudio:
          preferences.includeDisplayAudio &&
          mode !== "screen" &&
          mode !== "window",
        countdown: preferences.countdown,
        // The server writes the title: it names the freelancer for the client.
        title: null,
        jobSnapshotId: intent?.jobSnapshotId ?? null,
        areaRect: null,
        tabStreamId: null,
        tabSize: null,
        cameraLayer: "composite",
      },
    }).catch(() => setNotice("video.error.UNKNOWN"));
  }
  function finish() {
    if (state.shareUrl) void copyText(state.shareUrl);
    command("stop");
  }

  const error = state.phase === "failed" ? state.error : null;
  // The worker's own verdict wins: it saw what Chrome actually allowed.
  const captureStatus =
    error?.code === "TAB_CAPTURE_INVOKE"
      ? "needs-click"
      : error?.code === "TAB_CAPTURE_REQUIRED"
        ? "missing"
        : tabCapture.status;
  const tabModes = (mode === "tab" || mode === "area") && !fallback;
  const captureError = error?.code?.startsWith("TAB_CAPTURE_") ?? false;
  const errorKey: TranslationKey | null = error
    ? error.messageKey in en
      ? (error.messageKey as TranslationKey)
      : "video.error.UNKNOWN"
    : null;
  const limitsCode = limits.error ? errorCode(limits.error) : null;
  const needsGrant =
    snapshot &&
    ((preferences.cameraOn && snapshot.permissions.camera !== "granted") ||
      (preferences.micOn && snapshot.permissions.microphone !== "granted"));
  const denied =
    snapshot &&
    (snapshot.permissions.camera === "denied" ||
      snapshot.permissions.microphone === "denied");

  let body: ReactNode;
  if (!limits.data && !limits.error)
    body = (
      <Row>
        <LoaderCircle
          className="size-4 animate-spin text-muted-foreground"
          aria-hidden
        />
        <span className="px-1">{t("video.loading")}</span>
        <IconButton icon={X} label={t("video.close")} onClick={close} />
      </Row>
    );
  else if (
    limitsCode === "UNAUTHENTICATED" ||
    limitsCode === "UNAUTHORIZED" ||
    limitsCode === "NO_SESSION"
  )
    body = (
      <Row>
        <span className="px-1">{t("video.signInToRecord")}</span>
        <IconButton icon={X} label={t("video.close")} onClick={close} />
      </Row>
    );
  else if (limits.error || !limits.data?.available)
    body = (
      <Row>
        <span className="px-1">
          {t(limits.error ? "video.error.UNKNOWN" : "video.comingSoon")}
        </span>
        <IconButton icon={X} label={t("video.close")} onClick={close} />
      </Row>
    );
  else if (stage === "recording")
    body = (
      <RecordingPill
        state={state}
        confirm={confirm}
        setConfirm={setConfirm}
        onCommand={command}
        onFinish={finish}
        compact={embedded}
      />
    );
  else if (stage === "starting")
    body = (
      <Row>
        <span className="grid size-7 place-items-center" aria-hidden>
          <BrandThinkingOrb
            size={20}
            state="connecting"
            color="var(--primary)"
            style={{ height: 18, width: 18 }}
          />
        </span>
        <span role="status" className="px-1 font-medium">
          {t(
            state.phase === "countdown"
              ? "video.getReady"
              : state.phase === "picking"
                ? "video.chooseShare"
                : "video.starting",
          )}
        </span>
        <Action onClick={() => command("cancel")}>{t("video.cancel")}</Action>
      </Row>
    );
  else if (stage === "uploading") {
    const percent = Math.min(
      99,
      Math.round(
        (state.bytesUploaded / Math.max(1, state.bytesRecorded)) * 100,
      ),
    );
    body = (
      <div className="grid w-[320px] gap-1.5 px-1 py-0.5">
        <Row>
          <span className="grid size-6 place-items-center" aria-hidden>
            <BrandThinkingOrb
              size={20}
              state="weaving"
              color="var(--primary)"
              style={{ height: 18, width: 18 }}
            />
          </span>
          <span role="status" className="font-medium">
            {t("video.uploadProgress", { percent })}
          </span>
        </Row>
        <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        {copied && (
          <p className="text-xs text-muted-foreground">{t("video.linkCopiedEarly")}</p>
        )}
      </div>
    );
  } else if (stage === "done")
    body = (
      <div className="grid gap-1.5">
        <Row className="gap-1.5 pl-0.5">
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"
          >
            <Check className="size-3.5" strokeWidth={2.5} />
          </span>
          <span role="status" className="pr-1 font-medium">
            {t(copied ? "video.linkCopied" : "video.ready")}
          </span>
          <Divider />
          <Action
            primary
            icon={copied ? Check : Copy}
            onClick={() => state.shareUrl && void copyText(state.shareUrl)}
          >
            {t(copied ? "video.copied" : "video.copyLink")}
          </Action>
          <Action
            icon={ExternalLink}
            onClick={() => state.shareUrl && openTab(state.shareUrl)}
          >
            {t("video.open")}
          </Action>
          <Action icon={Plus} onClick={() => command("reset")}>
            {t("video.newRecording")}
          </Action>
          <Divider />
          <IconButton icon={X} label={t("video.close")} onClick={close} />
        </Row>
        {copyFailed && state.shareUrl ? (
          <ManualCopy url={state.shareUrl} />
        ) : null}
      </div>
    );
  else {
    const limit = limits.data;
    const canStart = loaded && !state.recoveries.length;
    const menuKind = menu ?? lastMenu;
    const usage = storageUsage(limit, t, locale);
    body = (
      <div className="grid gap-1">
        {menuPresence.mounted && (
          <div
            className={`origin-bottom transition-[opacity,transform] duration-150 ease-out ${
              menuPresence.shown
                ? "translate-y-0 scale-100 opacity-100"
                : "translate-y-1.5 scale-[.98] opacity-0"
            }`}
          >
            {menuKind === "usage" ? (
              <UsagePanel
                limit={limit}
                intentTitle={intent?.title ?? null}
                onClose={() => setMenu(null)}
              />
            ) : (
              <DeviceMenu
                kind={menuKind}
                devices={menuKind === "camera" ? cameras : mics}
                selected={menuKind === "camera" ? camera : mic}
                onSelect={(deviceId) => {
                  update(
                    menuKind === "camera"
                      ? { cameraDeviceId: deviceId, cameraOn: true }
                      : { micDeviceId: deviceId, micOn: true },
                  );
                  setMenu(null);
                }}
                onClose={() => setMenu(null)}
              />
            )}
          </div>
        )}
        <div className="flex items-stretch justify-center gap-0.5">
          <IconButton icon={X} label={t("video.close")} onClick={close} tall />
          <Divider />
          {/* The sources say what they are; the question that used to head them is their name. */}
          <div
            role="group"
            aria-label={t("video.whatToRecord")}
            className="flex items-stretch gap-0.5"
          >
            {modes.map(({ mode: value, icon, key }) => (
              <BarButton
                key={value}
                icon={icon}
                label={t(key)}
                pressed={mode === value}
                onClick={() => update({ mode: value })}
              />
            ))}
          </div>
          <Divider />
          <BarButton
            icon={preferences.cameraOn ? Video : VideoOff}
            label={t("video.camera")}
            pressed={preferences.cameraOn}
            toggle
            onClick={() => update({ cameraOn: !preferences.cameraOn })}
            onMenu={() => setMenu(menu === "camera" ? null : "camera")}
            menuOpen={menu === "camera"}
            menuLabel={t("video.chooseCamera")}
          />
          <BarButton
            icon={
              preferences.blur && blurStatus === "loading"
                ? LoaderCircle
                : BackgroundBlur
            }
            spin={preferences.blur && blurStatus === "loading"}
            label={t("video.blur")}
            pressed={preferences.blur && preferences.cameraOn}
            toggle
            disabled={!preferences.cameraOn}
            onClick={() => update({ blur: !preferences.blur })}
          />
          <BarButton
            icon={preferences.micOn ? Mic : MicOff}
            label={t("video.mic")}
            pressed={preferences.micOn}
            toggle
            level={preferences.micOn && micPreview ? level : null}
            onClick={() => update({ micOn: !preferences.micOn })}
            onMenu={() => setMenu(menu === "microphone" ? null : "microphone")}
            menuOpen={menu === "microphone"}
            menuLabel={t("video.chooseMicrophone")}
          />
          {/* Always in place, so switching modes never reflows the bar. */}
          <BarButton
            icon={preferences.includeDisplayAudio ? Volume2 : VolumeX}
            label={t("video.tabAudio")}
            pressed={preferences.includeDisplayAudio}
            toggle
            disabled={mode === "screen" || mode === "window"}
            onClick={() =>
              update({ includeDisplayAudio: !preferences.includeDisplayAudio })
            }
          />
          <Divider />
          <RecordButton
            disabled={
              !canStart ||
              (tabModes && mode === "area" && captureStatus === "needs-click")
            }
            onClick={() => void start()}
          >
            {t("video.start")}
          </RecordButton>
          <UsageButton
            label={t("video.planUsage")}
            summary={usage}
            open={menu === "usage"}
            onClick={() => setMenu(menu === "usage" ? null : "usage")}
          />
        </div>
        {/* Usage waits behind its button; only what stops a start is always on screen. */}
        {state.recoveries.length > 0 && (
          <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[10.5px] leading-tight whitespace-nowrap text-muted-foreground">
            <span className="text-warning-foreground">
              {t("video.recoveryInPanel")}
            </span>
          </footer>
        )}
        {needsGrant && (
          <Row className="justify-center text-xs">
            <span className="text-foreground/80">
              {t(denied ? "video.permissionDenied" : "video.permissionHelp")}
            </span>
            <Action
              primary
              onClick={() =>
                openTab(
                  denied
                    ? `chrome://settings/content/siteDetails?site=${encodeURIComponent(`chrome-extension://${browser.runtime.id}`)}`
                    : browser.runtime.getURL("/media-permission.html"),
                )
              }
            >
              {t(denied ? "video.openSettings" : "video.allowMedia")}
            </Action>
          </Row>
        )}
        {tabModes && captureStatus === "missing" && (
          <Row className="justify-center text-xs">
            <span className="max-w-[52ch] whitespace-normal text-foreground/80">
              <span className="font-medium text-foreground">
                {t("video.tabCapture.title")}
              </span>{" "}
              {t("video.tabCapture.body")}
            </span>
            <Action primary onClick={() => void tabCapture.request()}>
              {t("video.tabCapture.allow")}
            </Action>
          </Row>
        )}
        {tabModes && captureStatus === "needs-click" && (
          <Row className="justify-center text-xs">
            <img src="/icon/32.png" alt="" className="size-4 shrink-0" />
            <span
              role="status"
              className="max-w-[56ch] whitespace-normal text-foreground"
            >
              {t("video.tabCapture.clickIcon")}
              {tabCapture.shortcut && (
                <>
                  {" "}
                  {t("video.tabCapture.shortcut")}{" "}
                  <kbd className="rounded bg-foreground/15 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-foreground">
                    {tabCapture.shortcut}
                  </kbd>
                  .
                </>
              )}
            </span>
          </Row>
        )}
        {preferences.blur &&
          preferences.cameraOn &&
          blurStatus === "unavailable" && (
            <p
              role="status"
              title={blurReason}
              className="text-center text-xs text-warning-foreground"
            >
              {t("video.blurUnavailable")}
            </p>
          )}
        {(notice || (errorKey && !captureError)) && (
          <p role="alert" className="text-center text-xs text-warning-foreground">
            {t(notice ?? errorKey ?? "video.error.UNKNOWN")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      ref={root}
      className="w-max select-none bg-popover px-2 py-1.5 text-[13px] text-popover-foreground antialiased"
    >
      {body}
    </div>
  );
}

/** The bar's primary action: Record while setting up, Finish while recording. One look for both. */
const PRIMARY_ACTION =
  "flex h-9 items-center gap-1.5 rounded-lg bg-primary pr-3 pl-2 text-[13px] font-semibold whitespace-nowrap text-primary-foreground shadow-[0_0_0_1px_rgba(255,255,255,.08),0_4px_14px_-6px_var(--primary)] transition hover:brightness-105 active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none";

function RecordButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`ml-1 self-center ${PRIMARY_ACTION}`}
    >
      <span className="grid size-5 place-items-center" aria-hidden>
        <BrandThinkingOrb
          size={20}
          state="composing"
          paused={disabled}
          color="var(--primary-foreground)"
          style={{ height: 18, width: 18 }}
        />
      </span>
      {children}
    </button>
  );
}

function RecordingPill({
  state,
  confirm,
  setConfirm,
  onCommand,
  onFinish,
  compact,
}: {
  state: SessionState;
  confirm: "restart" | "cancel" | null;
  setConfirm: (value: "restart" | "cancel" | null) => void;
  onCommand: (type: "pause" | "resume" | "stop" | "restart" | "cancel") => void;
  onFinish: () => void;
  /** In the page frame the extra controls wait for hover. The fallback tab shows them all. */
  compact: boolean;
}) {
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());
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
  const warn = elapsed >= max - 30_000;
  const paused = state.phase === "paused";
  const live = (update: { micMuted?: boolean; cameraVisible?: boolean }) =>
    void sendRecording({
      target: "background",
      type: "recording/live",
      update,
    });
  if (confirm)
    return (
      <Row className="pl-1">
        <span className="pr-1 font-medium">
          {t(
            confirm === "restart"
              ? "video.confirmRestart"
              : "video.confirmDiscard",
          )}
        </span>
        <Action
          danger
          onClick={() => {
            onCommand(confirm);
            setConfirm(null);
          }}
        >
          {t("video.confirm")}
        </Action>
        <Action onClick={() => setConfirm(null)}>
          {t("video.keepRecording")}
        </Action>
      </Row>
    );
  // Compact while recording: the timer, Restart and Finish. The other controls show on hover or
  // keyboard focus, and stay out whenever they are in their non-default state (paused, muted,
  // camera hidden) so that state is never hidden.
  // Restart and Finish come first and never move: the extras open to their right, and the page
  // host keeps the pill's left edge where it is (see `revealWidths` and `barBox`). A control
  // that appeared between them slid Finish away from the pointer.
  return (
    <div className="group/pill grid gap-1" data-slot="recording-pill">
      <Row className="justify-self-start">
        <span
          role="timer"
          className={`flex items-center gap-1.5 px-1 font-semibold whitespace-nowrap tabular-nums ${warn ? "text-warning-foreground" : ""}`}
        >
          <span
            aria-hidden
            className={`size-2 rounded-full ${paused ? "bg-amber-400" : "animate-pulse bg-red-500"}`}
          />
          {/* As wide as the longest clock, so "9:59" to "10:00" does not push the buttons. */}
          <span
            className="inline-block"
            style={{ minWidth: `${formatClock(max === Infinity ? 0 : max).length}ch` }}
          >
            {formatClock(elapsed)}
          </span>
          <span className="font-normal text-muted-foreground">
            / {formatClock(state.maxDurationMs ?? 0)}
          </span>
        </span>
        <Divider />
        <IconButton
          icon={RotateCcw}
          label={t("video.restart")}
          onClick={() => setConfirm("restart")}
        />
        <button
          type="button"
          onClick={onFinish}
          className={`mx-0.5 ${PRIMARY_ACTION}`}
        >
          {/* The same 20px icon slot as Record's orb, so the two buttons line up. */}
          <span className="grid size-5 place-items-center" aria-hidden>
            <Square className="size-3 fill-current" />
          </span>
          {t("video.finish")}
        </button>
        <IconButton
          icon={paused ? Play : Pause}
          label={t(paused ? "video.resume" : "video.pause")}
          onClick={() => onCommand(paused ? "resume" : "pause")}
          collapsed={compact && !paused}
        />
        <IconButton
          icon={state.live.micMuted ? MicOff : Mic}
          label={t(state.live.micMuted ? "video.unmute" : "video.mute")}
          pressed={!state.live.micMuted}
          onClick={() => live({ micMuted: !state.live.micMuted })}
          collapsed={compact && !state.live.micMuted}
        />
        <IconButton
          icon={state.live.cameraVisible ? Video : VideoOff}
          label={t(
            state.live.cameraVisible ? "video.hideCamera" : "video.showCamera",
          )}
          pressed={state.live.cameraVisible}
          onClick={() => live({ cameraVisible: !state.live.cameraVisible })}
          collapsed={compact && state.live.cameraVisible}
        />
        <IconButton
          icon={Trash2}
          label={t("video.discard")}
          onClick={() => setConfirm("cancel")}
          collapsed={compact}
        />
      </Row>
      {(warn ||
        !state.uploadHealthy ||
        state.warnings.some((w) => w !== "limit")) && (
        <p
          role="status"
          className="justify-self-start px-1 text-[11px] text-warning-foreground"
        >
          {warn
            ? t("video.stopsAt", {
                duration: formatClock(state.maxDurationMs ?? 0),
              })
            : !state.uploadHealthy
              ? t("video.reconnecting")
              : t(
                  `video.warning.${state.warnings.find((w) => w !== "limit") ?? "microphone"}` as TranslationKey,
                )}
        </p>
      )}
    </div>
  );
}

function DeviceMenu({
  kind,
  devices,
  selected,
  onSelect,
  onClose,
}: {
  kind: "camera" | "microphone";
  devices: MediaDevice[];
  selected: string | null;
  onSelect: (deviceId: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="listbox"
      aria-label={t(
        kind === "camera" ? "video.chooseCamera" : "video.chooseMicrophone",
      )}
      className="mx-auto grid w-full max-w-[420px] gap-0.5 rounded-xl bg-foreground/[.06] p-1"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      {devices.length === 0 ? (
        <p className="px-2.5 py-2 text-xs text-muted-foreground">
          {t("video.allowToList")}
        </p>
      ) : (
        devices.map((device, index) => (
          <button
            key={device.deviceId}
            type="button"
            role="option"
            aria-selected={device.deviceId === selected}
            onClick={() => onSelect(device.deviceId)}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-foreground/10 focus-visible:bg-foreground/10 focus-visible:outline-none ${
              device.deviceId === selected ? "text-primary" : "text-foreground/90"
            }`}
          >
            <Check
              aria-hidden
              className={`size-3.5 shrink-0 transition-opacity ${device.deviceId === selected ? "opacity-100" : "opacity-0"}`}
            />
            <span className="truncate">
              {device.label || t("video.device", { count: index + 1 })}
            </span>
          </button>
        ))
      )}
    </div>
  );
}

/** Opens the usage panel: storage used and the longest recording. */
function UsageButton({
  label,
  summary,
  open,
  onClick,
}: {
  label: string;
  summary: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      title={summary}
      onClick={onClick}
      className={`ml-0.5 grid w-8 shrink-0 place-items-center self-stretch rounded-lg transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground ${open ? "bg-foreground/10 text-foreground" : "text-foreground/70"}`}
    >
      <InfinityIcon className="size-4" aria-hidden />
    </button>
  );
}

/** Storage used (there is no cap) and the longest recording. */
function storageUsage(
  limit: VideoLimits,
  t: ReturnType<typeof useI18n>["t"],
  locale: string,
): string {
  return t("video.usageUnlimited", {
    used: formatBytes(limit.storage.usedBytes, locale),
    minutes: Math.floor(limit.maxDurationMs / 60_000),
  });
}

/** Opened from the usage button: what this recording is for, and the storage it uses. */
function UsagePanel({
  limit,
  intentTitle,
  onClose,
}: {
  limit: VideoLimits;
  intentTitle: string | null;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  return (
    <div
      role="region"
      aria-label={t("video.planUsage")}
      className="mx-auto grid w-full max-w-[420px] gap-1.5 rounded-xl bg-foreground/[.06] px-3 py-2 text-xs"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      {intentTitle && (
        <p className="truncate font-medium text-foreground/90">{intentTitle}</p>
      )}
      <p className="text-muted-foreground">{storageUsage(limit, t, locale)}</p>
    </div>
  );
}

/** Shown only when every copy path failed: the link, selected, ready for ⌘C / Ctrl+C. */
function ManualCopy({ url }: { url: string }) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="flex items-center gap-2 px-1 pb-0.5 text-xs text-muted-foreground"
    >
      <span className="shrink-0">{t("video.copyManually")}</span>
      <input
        readOnly
        autoFocus
        value={url}
        size={Math.min(url.length, 44)}
        aria-label={t("video.shareLinkField")}
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 rounded-md border bg-background px-2 py-1 font-mono text-xs text-foreground"
      />
    </div>
  );
}

/** Measures the bar for `revealWidths`: the page host needs its width with the extras closed and open. */
function measureReveal(root: HTMLElement): { rest: number; full: number } {
  const w = root.offsetWidth;
  const controls = [...root.querySelectorAll<HTMLElement>("[data-reveal]")];
  const row = controls[0]?.parentElement;
  if (!row) return { rest: w, full: w };
  // Every icon button is the same square; a closed one (`display: none`) measures 0.
  const open = controls.filter((control) => control.offsetWidth > 0);
  return revealWidths({
    w,
    row: row.offsetWidth,
    // The row and the line under it keep their own widths; the wider one sets the bar's.
    below: Math.max(
      0,
      ...[...(row.parentElement?.children ?? [])]
        .filter((child) => child !== row)
        .map((child) => (child as HTMLElement).offsetWidth),
    ),
    open: open.length,
    closed: controls.length - open.length,
    unit:
      (open[0]?.offsetWidth ??
        row.querySelector<HTMLElement>("button")?.offsetWidth ??
        36) + (parseFloat(getComputedStyle(row).columnGap) || 0),
  });
}
function Row({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 whitespace-nowrap ${className}`}>
      {children}
    </div>
  );
}
function Divider() {
  return <span aria-hidden className="mx-0.5 my-1 w-px self-stretch bg-foreground/10" />;
}
function IconButton({
  icon: Icon,
  label,
  onClick,
  pressed,
  tall,
  collapsed,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  tall?: boolean;
  /** Hidden until the recording pill is hovered or holds keyboard focus. */
  collapsed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      data-reveal={collapsed ? "" : undefined}
      onClick={onClick}
      className={`${collapsed ? "hidden group-hover/pill:grid group-focus-within/pill:grid" : "grid"} shrink-0 place-items-center rounded-lg text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground ${tall ? "w-8 self-stretch" : "size-8"}`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
/** A real button: a filled pill with an optional icon, never bare text. */
function Action({
  children,
  onClick,
  primary,
  danger,
  icon: Icon,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground active:scale-[.98] ${
        danger
          ? "bg-red-600 text-white hover:bg-red-500"
          : primary
            ? "bg-primary text-primary-foreground hover:brightness-105"
            : "bg-foreground/[.08] text-foreground ring-1 ring-foreground/10 ring-inset hover:bg-foreground/[.14]"
      }`}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}
function BarButton({
  icon: Icon,
  label,
  pressed,
  toggle,
  onClick,
  onMenu,
  menuOpen,
  menuLabel,
  level,
  disabled,
  spin,
}: {
  icon: LucideIcon;
  label: string;
  pressed: boolean;
  toggle?: boolean;
  disabled?: boolean;
  spin?: boolean;
  onClick: () => void;
  onMenu?: () => void;
  menuOpen?: boolean;
  menuLabel?: string;
  /** The live mic level, or null to fade the meter out. */
  level?: number | null;
}) {
  const active = pressed
    ? toggle
      ? "bg-foreground/[.1] text-foreground"
      : "bg-primary/15 text-primary"
    : toggle
      ? "text-muted-foreground/70 hover:text-foreground/90"
      : "text-foreground/80 hover:text-foreground";
  return (
    <div className="relative flex shrink-0">
      <button
        type="button"
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
        className={`relative flex min-w-[52px] flex-col items-center gap-[5px] rounded-lg px-1.5 pt-[7px] pb-2 text-[10.5px] whitespace-nowrap transition-[color,background-color,opacity] duration-200 hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-foreground disabled:pointer-events-none disabled:opacity-30 ${active}`}
      >
        <Icon className={`size-4 ${spin ? "animate-spin" : ""}`} aria-hidden />
        <span className="leading-none">{label}</span>
        {/* Laid over the bottom padding, so the meter adds no height to the row. */}
        {level !== undefined && (
          <span
            aria-hidden
            className={`absolute bottom-[3px] left-1/2 h-0.5 w-6 -translate-x-1/2 overflow-hidden rounded-full bg-foreground/10 transition-opacity duration-200 ${level === null ? "opacity-0" : "opacity-100"}`}
          >
            <span
              className="block h-full bg-primary transition-[width] duration-100"
              style={{ width: `${Math.round((level ?? 0) * 100)}%` }}
            />
          </span>
        )}
      </button>
      {onMenu && (
        <button
          type="button"
          aria-label={menuLabel}
          aria-expanded={menuOpen}
          title={menuLabel}
          onClick={onMenu}
          className="absolute top-0 right-0 grid size-4 place-items-center rounded text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground"
        >
          <ChevronUp
            className={`size-3 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      )}
    </div>
  );
}
