import { browser } from "wxt/browser";
import { connectionTokenProvider } from "@/features/connection/connection-store";
import { ApiClientError, type TokenProvider } from "@/services/api";
import { videosService } from "@/services/videos";
import { IndexedChunkStore } from "./engine/chunk-store";
import {
  backgroundSchema,
  cornerSchema,
  hostToWorkerSchema,
  roundnessSchema,
  zoomSchema,
  initialState,
  intentSchema,
  PENDING_OPEN_KEY,
  PENDING_OPEN_TTL_MS,
  pendingOpenSchema,
  settingsSchema,
  sizeSchema,
  stateSchema,
  viewportSchema,
  type ApiRequest,
  type BackgroundMessage,
  type BubbleInCapture,
  type CameraLayer,
  type HostView,
  type RecorderIntent,
  type RecordingSettings,
  type SessionState,
} from "./protocol";
import { extensionPagePath } from "./senders";
import { reportError } from "@/features/diagnostics/error-log";
import { z } from "zod";

export async function callVideoApi(
  request: ApiRequest,
  getToken: TokenProvider,
): Promise<unknown> {
  switch (request.op) {
    case "getLimits":
      return videosService.getLimits(getToken);
    case "create":
      return videosService.create(request.payload, getToken);
    case "presignParts":
      return videosService.presignParts(
        request.payload.videoId,
        { partNumbers: request.payload.partNumbers },
        getToken,
      );
    case "listUploadedParts":
      return videosService.listUploadedParts(request.payload.videoId, getToken);
    case "complete":
      return videosService.complete(
        request.payload.videoId,
        {
          parts: request.payload.parts,
          clientDurationMs: request.payload.clientDurationMs,
        },
        getToken,
      );
    case "abortUpload":
      return videosService.abortUpload(request.payload.videoId, getToken);
    case "list":
      return videosService.list(request.payload, getToken);
    case "get":
      return videosService.get(request.payload.videoId, getToken);
    case "rename":
      return videosService.rename(
        request.payload.videoId,
        { title: request.payload.title },
        getToken,
      );
    case "remove":
      return videosService.remove(request.payload.videoId, getToken);
  }
}
export function badgeFor(phase: SessionState["phase"]) {
  return phase === "recording"
    ? { text: "REC", color: "#dc2626" }
    : phase === "paused"
      ? { text: "II", color: "#d97706" }
      : ["uploading", "completing"].includes(phase)
        ? { text: "↑", color: "#475569" }
        : { text: "", color: "#475569" };
}

/** Where the recorder UI lives and what it records. Kept in `storage.session`. */
export const uiSchema = z.object({
  /** The tab hosting the injected UI; null for the fallback recorder tab. */
  tabId: z.number().int().nullable(),
  mode: settingsSchema.shape.mode,
  cameraOn: z.boolean(),
  /** The tab captured through `tabCapture`, if any. */
  captureTabId: z.number().int().nullable(),
  /** The host tab's viewport, as its page host reports it. */
  viewport: viewportSchema.nullable().default(null),
});
export type RecorderUi = z.infer<typeof uiSchema>;
const ACTIVE = ["recording", "paused"];
const SETUP = ["idle", "acquiring", "picking", "creating", "countdown"];
/** The source is picked from here on: what the page shows may be inside the capture. */
const PICKED_SETUP = ["creating", "countdown"];

/**
 * What the injected page host shows. Pure, so the bubble rules are testable.
 *
 * The bubble stays on screen while recording in every mode (users expect to see themselves),
 * and the camera is in the video exactly once:
 * - the bubble is inside the capture: it is the camera, and the compositor draws none;
 * - it is outside (another window, another screen): the compositor draws the camera, and the
 *   bubble is only the user's own view;
 * - nobody could tell (`bubbleInCapture: "unknown"`): the compositor draws the camera and the
 *   bubble leaves before the first frame.
 * See `cameraLayerFor`, and `engine/marker-probe.ts` for how "inside" is found out.
 */
export function hostView(
  state: SessionState,
  ui: RecorderUi,
  selectingArea: boolean,
  connectedTabId: number | null,
  hostVisible = true,
): HostView {
  const live = ACTIVE.includes(state.phase);
  const capture = state.bubbleInCapture;
  const picked = PICKED_SETUP.includes(state.phase);
  const layer = cameraLayerFor(ui, connectedTabId, hostVisible, capture);
  // While choosing an area the bubble stays up: the host snaps it inside the selection.
  const bubble =
    ui.cameraOn &&
    (selectingArea
      ? true
      : SETUP.includes(state.phase) || state.phase === "failed"
        ? !(picked && capture === "unknown")
        : live
          ? state.live.cameraVisible && (layer === "page" || capture === "no")
          : false);
  return {
    type: "view",
    bar: !selectingArea,
    bubble,
    countdown: state.phase === "countdown" ? state.countdown : 0,
    selectArea: selectingArea,
    setup: state.phase === "idle" || state.phase === "failed",
    marker: !selectingArea && picked && capture === "probing",
  };
}
/**
 * Who draws the camera: the page bubble when it is inside what is being captured, the
 * compositor otherwise (also for a navigated or hidden host).
 * - One-click This tab and Area (`"assumed"`): the host is in the captured tab.
 * - A source from the browser's picker: only when the marker check said `"yes"`. A captured
 *   window or screen shows the bubble only while the host's tab is showing.
 */
export function cameraLayerFor(
  ui: RecorderUi,
  connectedTabId: number | null,
  hostVisible = true,
  capture: BubbleInCapture = "assumed",
): CameraLayer {
  if (connectedTabId === null) return "composite";
  if (capture === "yes")
    return ui.mode === "tab" || hostVisible ? "page" : "composite";
  if (capture !== "assumed") return "composite";
  return (ui.mode === "tab" || ui.mode === "area") &&
    ui.captureTabId === connectedTabId
    ? "page"
    : "composite";
}

const RECORDER_PAGES = ["/recorder-bar.html", "/recorder.html"];
/** `executeScript` refused because of the page itself, not because `activeTab` is missing. */
export function isRestrictedPageError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /cannot access (a )?(chrome|edge|about|chrome-extension|devtools)|cannot be scripted|extensions gallery|web store/i.test(
    message,
  );
}
const API_FROM_UI = ["getLimits", "list", "get", "rename", "remove"];

const RECORDER_SCRIPT = "/recorder-ui.js";

export function registerRecordingController() {
  if (import.meta.env.BROWSER === "firefox") return;
  // The same stored connection the side panel uses: no session of its own.
  const token = connectionTokenProvider;
  let creating: Promise<void> | undefined,
    teardown: ReturnType<typeof setTimeout> | undefined;
  let cached = { ...initialState };
  let mirrored = false;
  let mirrorQueue = Promise.resolve();
  let hostPort: Browser.runtime.Port | undefined;
  let hostTabId: number | null = null;
  let hostVisible = true;
  // The start waiting for an area. Kept in session storage: the worker may be stopped while
  // the user draws, and must still know what to start when the area arrives.
  const PENDING_AREA = "recording.pendingArea";
  async function readPendingArea(): Promise<RecordingSettings | undefined> {
    const value = (await browser.storage.session.get(PENDING_AREA))[
      PENDING_AREA
    ];
    const parsed = settingsSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  }
  /**
   * Chrome adds the tab-capture right to a toolbar click only if the extension already holds
   * `tabCapture` (active_tab_permission_granter.cc). Granted later, it needs one more click on
   * this tab, which then re-arms the open recorder instead of closing it.
   */
  const ARM_KEY = "recording.armTabCapture";
  async function armTabCapture(tabId: number | null | undefined) {
    if (tabId !== null && tabId !== undefined)
      await browser.storage.session.set({ [ARM_KEY]: tabId });
  }
  async function consumeArm(
    tab: Browser.tabs.Tab | undefined,
  ): Promise<boolean> {
    const armed = (await browser.storage.session.get(ARM_KEY))[ARM_KEY];
    const ui = await readUi();
    if (
      tab?.id === undefined ||
      armed !== tab.id ||
      ui?.tabId !== tab.id ||
      !hostPort ||
      ACTIVE.includes(cached.phase)
    )
      return false;
    await browser.storage.session.remove(ARM_KEY);
    await resetFinished();
    await broadcast({
      target: "recorder",
      type: "recorder/tab-capture",
      status: "ready",
    });
    await postView();
    return true;
  }
  /**
   * The settings of the last start, so Restart starts again exactly as Start did. Restart is a
   * cancel plus a new start from here, never a restart inside the engine: a tab stream id works
   * only once, and the old one would fail the new take.
   */
  const LAST_START = "recording.lastStart";
  async function readLastStart(): Promise<RecordingSettings | undefined> {
    const value = (await browser.storage.session.get(LAST_START))[LAST_START];
    const parsed = settingsSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  }
  let restarting = false;
  const settleWaiters = new Set<(state: SessionState) => void>();
  /** The next idle or failed state from the engine, or null after the timeout. */
  function nextSettled(timeoutMs = 15_000): Promise<SessionState | null> {
    return new Promise((resolve) => {
      const done = (state: SessionState | null) => {
        clearTimeout(timer);
        settleWaiters.delete(check);
        resolve(state);
      };
      const check = (state: SessionState) => {
        if (state.phase === "idle" || state.phase === "failed") done(state);
      };
      const timer = setTimeout(() => done(null), timeoutMs);
      settleWaiters.add(check);
    });
  }
  async function restart() {
    const last = await readLastStart();
    await ensureRecorderHost();
    if (!last) {
      await forward({ target: "offscreen", type: "recording/cancel" });
      return;
    }
    restarting = true;
    let started = false;
    try {
      const settled = nextSettled();
      await forward({ target: "offscreen", type: "recording/cancel" });
      if ((await settled)?.phase === "idle") started = await start(last);
    } finally {
      restarting = false;
      // Nothing new started: show the real state instead of "starting".
      if (!started) await mirror(cached);
    }
  }
  async function writePendingArea(settings: RecordingSettings | undefined) {
    if (settings)
      await browser.storage.session.set({ [PENDING_AREA]: settings });
    else await browser.storage.session.remove(PENDING_AREA);
  }
  const broadcast = (message: unknown) =>
    browser.runtime.sendMessage(message).catch(() => undefined);
  const forward = (message: unknown) => browser.runtime.sendMessage(message);
  const readState = async () => {
    const value = (await browser.storage.session.get("recording.state"))[
      "recording.state"
    ];
    return stateSchema.safeParse(value).success
      ? stateSchema.parse(value)
      : { ...initialState };
  };
  const readUi = async (): Promise<RecorderUi | null> => {
    const value = (await browser.storage.session.get("recording.ui"))[
      "recording.ui"
    ];
    const parsed = uiSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  };
  const writeUi = (ui: RecorderUi | null) =>
    ui
      ? browser.storage.session.set({ "recording.ui": ui })
      : browser.storage.session.remove("recording.ui");
  void readState().then((state) => {
    if (!mirrored) cached = state;
  });
  async function ensureRecorderHost() {
    clearTimeout(teardown);
    if (creating) return creating;
    creating = (async () => {
      const contexts = await browser.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
      });
      if (contexts.length) return;
      await browser.offscreen.createDocument({
        url: "/offscreen-recorder.html",
        reasons: ["DISPLAY_MEDIA", "USER_MEDIA", "BLOBS", "CLIPBOARD"],
        justification:
          "Records the screen, camera and microphone the user chose for a video proposal, and copies its share link.",
      });
    })();
    try {
      await creating;
    } finally {
      creating = undefined;
    }
  }
  async function postView() {
    if (!hostPort) return;
    const ui = await readUi();
    if (!ui) return;
    try {
      hostPort.postMessage(
        hostView(
          cached,
          ui,
          !!(await readPendingArea()),
          hostTabId,
          hostVisible,
        ),
      );
    } catch {
      hostPort = undefined;
    }
  }
  async function syncCameraLayer() {
    const ui = await readUi();
    if (
      !ui ||
      (!ACTIVE.includes(cached.phase) && !PICKED_SETUP.includes(cached.phase))
    )
      return;
    // The answer of the marker check is still out: the engine applies it itself.
    if (cached.bubbleInCapture === "probing") return;
    const layer = cameraLayerFor(
      ui,
      hostPort ? hostTabId : null,
      hostVisible,
      cached.bubbleInCapture,
    );
    if (layer !== cached.live.cameraLayer)
      await forward({
        target: "offscreen",
        type: "recording/live",
        update: { cameraLayer: layer },
      }).catch(() => undefined);
  }
  async function writeMirror(state: SessionState) {
    mirrored = true;
    // The marker check just answered: a host that went hidden meanwhile needs the compositor.
    const answered =
      cached.bubbleInCapture === "probing" &&
      state.bubbleInCapture !== "probing";
    cached = state;
    if (answered) void syncCameraLayer().catch(() => undefined);
    for (const waiter of [...settleWaiters]) waiter(state);
    await browser.storage.session.set({ "recording.state": state });
    // During a restart, the idle between the cancelled take and the new one is shown as
    // starting, not as a flash of the setup bar.
    const shown: SessionState =
      restarting && state.phase === "idle"
        ? { ...state, phase: "acquiring" }
        : state;
    const badge = badgeFor(state.phase);
    await Promise.all([
      browser.action?.setBadgeText({ text: badge.text }),
      browser.action?.setBadgeBackgroundColor({ color: badge.color }),
      broadcast({ target: "sidepanel", type: "recording/state", state: shown }),
      broadcast({ target: "recorder", type: "recording/state", state: shown }),
      postView(),
    ]);
    clearTimeout(teardown);
    if (
      ["idle", "done", "failed"].includes(state.phase) &&
      !state.recoveries.length &&
      !(await readUi())
    )
      teardown = setTimeout(() => {
        void browser.offscreen.closeDocument().catch(() => undefined);
      }, 5000);
  }
  function mirror(state: SessionState) {
    // Preserve phase order when several engine events arrive in the same turn.
    const next = mirrorQueue.then(() => writeMirror(state));
    mirrorQueue = next.catch(() => undefined);
    return next;
  }

  /**
   * Inject the recorder into a tab the user just invoked the extension on. A toolbar click or
   * the shortcut always carries `activeTab`, so a failure there means the page refuses scripts.
   * A side-panel click may not carry it; then the user is told to use the toolbar instead.
   */
  async function openRecorder(
    tab: Browser.tabs.Tab | undefined,
    intent: RecorderIntent | null,
    source: "toolbar" | "panel" = "toolbar",
  ): Promise<"page" | "fallback" | "needs-toolbar"> {
    if (intent)
      await browser.storage.session.set({ "recording.intent": intent });
    else await browser.storage.session.remove("recording.intent");
    await resetFinished();
    const previous = await readUi();
    const base: RecorderUi = {
      viewport: null,
      tabId: null,
      mode: previous?.mode ?? "window",
      cameraOn: previous?.cameraOn ?? false,
      captureTabId: ACTIVE.includes(cached.phase)
        ? (previous?.captureTabId ?? null)
        : null,
    };
    if (tab?.id !== undefined)
      try {
        // Recorded first: the injected host connects as soon as it runs.
        await writeUi({ ...base, tabId: tab.id });
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: [RECORDER_SCRIPT],
        });
        await browser.storage.session.remove(PENDING_OPEN_KEY);
        void ensureRecorderHost().catch(() => undefined);
        return "page";
      } catch (error: unknown) {
        // Browser pages, the store and the PDF viewer refuse scripts.
        if (source === "panel" && !isRestrictedPageError(error)) {
          await writeUi(previous);
          await browser.storage.session.set({
            [PENDING_OPEN_KEY]: { tabId: tab.id, requestedAt: Date.now() },
          });
          return "needs-toolbar";
        }
      }
    await writeUi({
      ...base,
      tabId: null,
      mode: base.mode === "window" ? "window" : "screen",
    });
    await browser.tabs.create({
      url: browser.runtime.getURL("/recorder.html"),
    });
    await browser.storage.session.remove(PENDING_OPEN_KEY);
    void ensureRecorderHost().catch(() => undefined);
    return "fallback";
  }
  /** A previous result or error must not greet the next recording. */
  async function resetFinished() {
    if (!["done", "failed"].includes(cached.phase)) return;
    await ensureRecorderHost().catch(() => undefined);
    await forward({ target: "offscreen", type: "recording/reset" }).catch(() =>
      mirror({ ...initialState, recoveries: cached.recoveries }),
    );
  }
  async function closeRecorder() {
    await writePendingArea(undefined);
    try {
      hostPort?.postMessage({ type: "close" });
    } catch {
      // The page is gone already.
    }
    hostPort = undefined;
    hostTabId = null;
    if (!ACTIVE.includes(cached.phase) && cached.phase !== "countdown") {
      await writeUi(null);
      await browser.storage.session.remove("recording.intent");
      await forward({
        target: "offscreen",
        type: "preview/configure",
        cameraDeviceId: null,
        micDeviceId: null,
      }).catch(() => undefined);
      await mirror(cached);
    }
  }
  async function bubblePreferences() {
    const value = (await browser.storage.local.get("recording.bubble"))[
      "recording.bubble"
    ];
    const parsed = z
      .object({
        corner: cornerSchema,
        size: sizeSchema,
        roundness: roundnessSchema.catch(1),
        zoom: zoomSchema.catch(1),
      })
      .safeParse(value);
    return parsed.success ? parsed.data : null;
  }
  /**
   * The host page's geometry, from its own viewport report and the tab's zoom (no permission
   * needed). Null without a full report: the compositor then sizes its camera by share.
   */
  async function pageGeometry(
    ui: RecorderUi,
  ): Promise<RecordingSettings["pageGeometry"]> {
    const viewport = ui.viewport;
    if (!viewport?.outerW || !viewport.screenW || ui.tabId === null)
      return null;
    const zoom = await browser.tabs.getZoom(ui.tabId).catch(() => 1);
    return {
      innerW: viewport.w,
      outerW: viewport.outerW,
      screenW: viewport.screenW,
      zoom: Number.isFinite(zoom) ? Math.min(5, Math.max(0.25, zoom)) : 1,
    };
  }

  /** Start a recording. Tab and Area go through `tabCapture` when it was granted. */
  async function start(requested: RecordingSettings): Promise<boolean> {
    const ui = await readUi();
    if (!ui) return false;
    const bubble = await bubblePreferences();
    const settings: RecordingSettings = {
      ...requested,
      // Never trust a page-provided stream id, size, geometry or layer.
      tabStreamId: null,
      tabSize: null,
      pageGeometry: await pageGeometry(ui),
      cameraLayer: "composite",
      ...(bubble
        ? {
            bubbleCorner: bubble.corner,
            bubbleSize: bubble.size,
            bubbleRoundness: bubble.roundness,
            bubbleZoom: bubble.zoom,
          }
        : {}),
    };
    const tabMode = settings.mode === "tab" || settings.mode === "area";
    const granted =
      tabMode &&
      ui.tabId !== null &&
      (await browser.permissions
        .contains({ permissions: ["tabCapture"] })
        .catch(() => false));
    if (settings.mode === "area" && !granted) {
      await mirror({
        ...cached,
        phase: "failed",
        error: {
          code: "TAB_CAPTURE_REQUIRED",
          messageKey: "video.error.TAB_CAPTURE_REQUIRED",
        },
      });
      return false;
    }
    if (settings.mode === "area" && !settings.areaRect) {
      await writePendingArea(settings);
      await broadcast({
        target: "recorder",
        type: "recorder/area",
        status: "selecting",
      });
      await postView();
      return false;
    }
    let captureTabId: number | null = null;
    await ensureRecorderHost();
    // This tab through the picker still records the host tab in the common case.
    if (settings.mode === "tab" && ui.tabId !== null) captureTabId = ui.tabId;
    if (granted && ui.tabId !== null)
      try {
        settings.tabStreamId = await browser.tabCapture.getMediaStreamId({
          targetTabId: ui.tabId,
        });
        captureTabId = ui.tabId;
        settings.tabSize = ui.viewport
          ? {
              w: Math.round(ui.viewport.w * ui.viewport.dpr),
              h: Math.round(ui.viewport.h * ui.viewport.dpr),
            }
          : null;
      } catch (error: unknown) {
        // Diagnostics only (the worker console): usually "not invoked for the current page".
        console.warn("upwin: tab capture refused", error);
        if (settings.mode === "area") {
          await armTabCapture(ui.tabId);
          await mirror({
            ...cached,
            phase: "failed",
            error: {
              code: "TAB_CAPTURE_INVOKE",
              messageKey: "video.error.TAB_CAPTURE_INVOKE",
            },
          });
          return false;
        }
        // This tab without a stream id falls back to the browser picker's tab list.
      }
    const next: RecorderUi = {
      ...ui,
      mode: settings.mode,
      cameraOn: !!settings.cameraDeviceId && settings.cameraVisible,
      captureTabId,
    };
    await writeUi(next);
    // Only one-click tab capture knows its tab. A picked source starts with the compositor's
    // camera, and the engine's marker check decides before the first frame.
    settings.cameraLayer = settings.tabStreamId
      ? cameraLayerFor(next, hostPort ? hostTabId : null, hostVisible)
      : "composite";
    await browser.storage.session.set({
      [LAST_START]: { ...settings, tabStreamId: null, tabSize: null },
    });
    await forward({ target: "offscreen", type: "recording/start", settings });
    return true;
  }

  browser.runtime.onConnect.addListener((port) => {
    if (
      port.name !== "recorder-ui" ||
      port.sender?.id !== browser.runtime.id ||
      port.sender.tab?.id === undefined
    )
      return;
    const tabId = port.sender.tab.id;
    // Registered synchronously: the host reports its viewport the moment it connects.
    const previousPort = hostPort,
      previousTabId = hostTabId;
    hostPort = port;
    hostTabId = tabId;
    hostVisible = true;
    void (async () => {
      const ui = await readUi();
      if (!ui || ui.tabId !== tabId) {
        // A stale host: only the tab the user last invoked the recorder on keeps it.
        if (hostPort === port) {
          hostPort = previousPort;
          hostTabId = previousTabId;
        }
        port.postMessage({ type: "close" });
        port.disconnect();
        return;
      }
      if (previousPort && previousPort !== port)
        try {
          previousPort.postMessage({ type: "close" });
        } catch {
          // Gone already.
        }
      await postView();
      await syncCameraLayer();
    })();
    port.onMessage.addListener((raw: unknown) => {
      if (port !== hostPort) return;
      const parsed = hostToWorkerSchema.safeParse(raw);
      if (!parsed.success) return;
      const message = parsed.data;
      void (async () => {
        switch (message.type) {
          case "area": {
            const pending = await readPendingArea();
            await writePendingArea(undefined);
            // Nothing waiting (a re-sent area after a reconnect, or already started): resync only.
            if (!pending) {
              await postView();
              return;
            }
            if (!message.rect) {
              await broadcast({
                target: "recorder",
                type: "recorder/area",
                status: "cancelled",
              });
              await postView();
              return;
            }
            await postView();
            await start({ ...pending, areaRect: message.rect });
            return;
          }
          case "bubble":
            await browser.storage.local.set({
              "recording.bubble": {
                corner: message.corner,
                size: message.size,
                roundness: message.roundness,
                zoom: message.zoom,
              },
            });
            if (ACTIVE.includes(cached.phase))
              await forward({
                target: "offscreen",
                type: "recording/live",
                update: {
                  bubbleCorner: message.corner,
                  bubbleSize: message.size,
                  bubbleRoundness: message.roundness,
                  bubbleZoom: message.zoom,
                },
              });
            return;
          case "viewport": {
            const ui = await readUi();
            if (ui && ui.tabId === hostTabId)
              await writeUi({ ...ui, viewport: message.viewport });
            return;
          }
          case "visibility":
            hostVisible = message.visible;
            await syncCameraLayer();
            await postView();
            return;
          case "skip-countdown":
            await forward({
              target: "offscreen",
              type: "recording/skip-countdown",
            });
            return;
          case "marker-shown":
            // Only a visible page proves anything: a hidden one paints no marker.
            if (hostVisible)
              await forward({
                target: "offscreen",
                type: "recording/marker-shown",
              });
            return;
          case "close":
            await closeRecorder();
            return;
        }
      })().catch(() => undefined);
    });
    port.onDisconnect.addListener(() => {
      if (port !== hostPort) return;
      hostPort = undefined;
      hostTabId = null;
      // The page navigated or closed. While recording, the compositor takes over the camera.
      void syncCameraLayer().catch(() => undefined);
    });
  });

  browser.runtime.onMessage.addListener((raw: unknown, sender, respond) => {
    const parsed = backgroundSchema.safeParse(raw);
    if (!parsed.success) return false;
    const message = parsed.data;
    const page = extensionPagePath(sender);
    if (!page) return false;
    const engine = page === "/offscreen-recorder.html",
      panel = page === "/sidepanel.html",
      recorder = RECORDER_PAGES.includes(page),
      permission = page === "/media-permission.html";
    if (!engine && !panel && !recorder && !permission) return false;
    if (
      message.type.startsWith("engine/") &&
      !engine &&
      !(
        (panel || recorder) &&
        message.type === "engine/api" &&
        API_FROM_UI.includes(message.op)
      )
    )
      return false;
    if (message.type.startsWith("recording/") && !panel && !recorder)
      return false;
    if (message.type === "recorder/open" && !panel) return false;
    if (
      message.type.startsWith("recorder/") &&
      message.type !== "recorder/open" &&
      !recorder
    )
      return false;
    if (message.type === "media-permission/result" && !permission) return false;
    void (async () => {
      switch (message.type) {
        case "engine/state": {
          const state = message.state;
          // An engine failure is reported once, here: the offscreen document has no
          // storage. The ref rides along in the state, so every UI shows the same one.
          if (
            state.phase === "failed" &&
            state.error &&
            !state.error.ref &&
            (cached.phase !== "failed" || cached.error?.code !== state.error.code)
          ) {
            const record = reportError({
              error: { code: state.error.code },
              operation: "recording.engine",
              surface: "offscreen",
              meta: { previousPhase: cached.phase },
            });
            await mirror({
              ...state,
              error: { ...state.error, ref: record.ref },
            });
            return;
          }
          await mirror(state);
          return;
        }
        case "recording/get-state": {
          const contexts = await browser.runtime.getContexts({
            contextTypes: ["OFFSCREEN_DOCUMENT"],
          });
          if (!contexts.length) {
            const pending = await new IndexedChunkStore().listUnfinished();
            if (pending.length) await ensureRecorderHost();
            else await mirror({ ...initialState });
          }
          return readState();
        }
        case "engine/api": {
          // The reply goes straight back to the caller; UI pages share one result shape.
          const target = engine ? "offscreen" : "sidepanel";
          try {
            return {
              target,
              type: "api/result",
              requestId: message.requestId,
              ok: true,
              data: await callVideoApi(message, token),
            };
          } catch (error: unknown) {
            // Reported here, where the full error (status, request id) still exists.
            // The caller shows this ref instead of minting its own.
            const record = reportError({
              error,
              operation: `videos.${message.op}`,
              surface: "worker",
              meta: { caller: engine ? "offscreen" : "ui" },
            });
            return {
              target,
              type: "api/result",
              requestId: message.requestId,
              ok: false,
              error: {
                code:
                  error instanceof ApiClientError
                    ? (error.code ??
                      (error.status === 401
                        ? "UNAUTHENTICATED"
                        : error.status && error.status >= 500
                          ? "NETWORK_ERROR"
                          : "UNKNOWN"))
                    : error instanceof TypeError
                      ? "NETWORK_ERROR"
                      : "UNKNOWN",
                message: "Video request failed.",
                ref: record.ref,
                ...(record.httpStatus ? { status: record.httpStatus } : {}),
                ...(record.requestId ? { apiRequestId: record.requestId } : {}),
              },
            };
          }
        }
        case "media-permission/result":
          await broadcast({ ...message, target: "sidepanel" });
          await forward({ target: "offscreen", type: "preview/refresh" }).catch(
            () => undefined,
          );
          return;
        case "engine/closed":
          return;
        case "recorder/open": {
          const [tab] = await browser.tabs.query({
            active: true,
            lastFocusedWindow: true,
          });
          return { opened: await openRecorder(tab, message.intent, "panel") };
        }
        case "recorder/close":
          await closeRecorder();
          return;
        case "recorder/preview": {
          const ui = await readUi();
          if (ui)
            await writeUi({
              ...ui,
              mode: message.mode,
              cameraOn: !!message.cameraDeviceId,
            });
          await ensureRecorderHost();
          await forward({
            target: "offscreen",
            type: "preview/configure",
            cameraDeviceId: message.cameraDeviceId,
            micDeviceId: message.micDeviceId,
            blur: message.blur,
          });
          await postView();
          return;
        }
        case "recorder/arm-tab-capture":
          await armTabCapture((await readUi())?.tabId);
          return;
        case "recorder/refresh-devices":
          await ensureRecorderHost();
          await forward({ target: "offscreen", type: "preview/refresh" });
          return;
        case "recorder/copy":
          await ensureRecorderHost();
          return forward({
            target: "offscreen",
            type: "clipboard/write",
            text: message.text,
          });
        case "recording/start":
          clearTimeout(teardown);
          await start(message.settings);
          return;
        case "recording/restart":
          clearTimeout(teardown);
          await writePendingArea(undefined);
          await restart();
          return;
        default:
          clearTimeout(teardown);
          if (message.type === "recording/cancel")
            await writePendingArea(undefined);
          await ensureRecorderHost();
          await forward({ ...message, target: "offscreen" });
          return;
      }
    })()
      .then(respond)
      .catch(() => respond({ error: { code: "RECORDING_FAILED" } }));
    return true;
  });

  async function readIntent(): Promise<RecorderIntent | null> {
    const intent = intentSchema.safeParse(
      (await browser.storage.session.get("recording.intent"))["recording.intent"],
    );
    return intent.success ? intent.data : null;
  }
  async function consumePendingOpen(
    tab: Browser.tabs.Tab | undefined,
  ): Promise<boolean> {
    const pending = pendingOpenSchema.safeParse(
      (await browser.storage.session.get(PENDING_OPEN_KEY))[PENDING_OPEN_KEY],
    );
    if (
      !pending.success ||
      tab?.id !== pending.data.tabId ||
      Date.now() - pending.data.requestedAt > PENDING_OPEN_TTL_MS
    )
      return false;
    // openRecorder clears the record once the recorder is up; the panel watches for that.
    await openRecorder(tab, await readIntent());
    return true;
  }

  // The toolbar icon opens the side panel (background.ts). The same click grants `activeTab`,
  // and the tab-capture right once `tabCapture` is held; this listener spends them only when the
  // recorder is waiting for them: the tab-capture re-arm, a Record the panel could not complete,
  // or the controls lost to a navigation while recording.
  browser.action?.onClicked.addListener((tab) => {
    void (async () => {
      if (await consumeArm(tab)) return;
      if (await consumePendingOpen(tab)) return;
      const state = await readState();
      if (!ACTIVE.includes(state.phase) && state.phase !== "countdown") return;
      const ui = await readUi();
      if (ui?.tabId === tab.id && hostPort) return;
      await openRecorder(tab, await readIntent());
    })().catch(() => undefined);
  });
  browser.commands.onCommand.addListener((command, tab) => {
    if (command !== "toggle-recording") return;
    void readState()
      .then(async (state) => {
        if (ACTIVE.includes(state.phase)) {
          await forward({ target: "offscreen", type: "recording/stop" });
          return;
        }
        if (await consumeArm(tab)) return;
        if (["idle", "done", "failed"].includes(state.phase))
          await openRecorder(tab, null);
      })
      .catch(() => undefined);
  });
  const recover = () => {
    void new IndexedChunkStore()
      .listUnfinished()
      .then(async (pending) => {
        if (pending.length) await ensureRecorderHost();
      })
      .catch(() => undefined);
  };
  browser.runtime.onStartup.addListener(recover);
  browser.runtime.onInstalled.addListener(recover);
  return { ensureRecorderHost, mirror, readState, openRecorder };
}

export type { BackgroundMessage };
