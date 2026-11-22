import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { browser } from "wxt/browser";
import {
  badgeFor,
  callVideoApi,
  cameraLayerFor,
  hostView,
  isRestrictedPageError,
  registerRecordingController,
  type RecorderUi,
} from "./background-controller";
import { defaultSettings, initialState } from "./protocol";
import { videosService } from "@/services/videos";
import { ApiClientError } from "@/services/api";
import { errorLogItem, whenPersisted } from "@/features/diagnostics/error-log";
type Listener = (...args: never[]) => unknown;
const listeners: Record<string, Listener> = {};
beforeEach(() => {
  fakeBrowser.reset();
  for (const [name, target] of [
    ["command", browser.commands.onCommand],
    ["connect", browser.runtime.onConnect],
    ["click", browser.action.onClicked],
    ["message", browser.runtime.onMessage],
  ] as const)
    vi.spyOn(target, "addListener").mockImplementation(((
      listener: Listener,
    ) => {
      listeners[name] = listener;
    }) as never);
  vi.spyOn(browser.action, "setBadgeText").mockResolvedValue();
  vi.spyOn(browser.action, "setBadgeBackgroundColor").mockResolvedValue();
});
const page = (path: string) => ({
  id: browser.runtime.id,
  url: `chrome-extension://${browser.runtime.id}${path}`,
});
function dispatch(message: unknown, sender: Browser.runtime.MessageSender) {
  return new Promise<unknown>((resolve) => {
    const handled = (
      listeners.message as unknown as (
        m: unknown,
        s: Browser.runtime.MessageSender,
        r: (v: unknown) => void,
      ) => boolean
    )(message, sender, resolve);
    if (!handled) resolve("ignored");
  });
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("forwards a typed broker call through the video service with the given token", async () => {
  const token = vi.fn(),
    create = vi.spyOn(videosService, "create").mockResolvedValue({} as never);
  const payload = {
    sourceKind: "screen",
    hasCamera: false,
    hasAudio: true,
    mimeType: "video/mp4",
  } as const;
  await callVideoApi({ op: "create", payload }, token);
  expect(create).toHaveBeenCalledWith(payload, token);
});
it.each([
  ["recording", "REC"],
  ["paused", "II"],
  ["uploading", "↑"],
  ["completing", "↑"],
  ["idle", ""],
  ["done", ""],
  ["failed", ""],
] as const)("badge for %s", (phase, text) =>
  expect(badgeFor(phase).text).toBe(text),
);
it("creates exactly one offscreen host for concurrent starts", async () => {
  vi.spyOn(browser.runtime, "getContexts").mockResolvedValue([] as never);
  const create = vi
    .spyOn(browser.offscreen, "createDocument")
    .mockResolvedValue();
  const controller = registerRecordingController()!;
  await Promise.all([
    controller.ensureRecorderHost(),
    controller.ensureRecorderHost(),
  ]);
  expect(create).toHaveBeenCalledTimes(1);
  expect(create.mock.calls[0]![0].reasons).toEqual([
    "DISPLAY_MEDIA",
    "USER_MEDIA",
    "BLOBS",
    "CLIPBOARD",
  ]);
});
it("tears down only terminal sessions without pending recovery after five seconds", async () => {
  vi.useFakeTimers();
  const close = vi
    .spyOn(browser.offscreen, "closeDocument")
    .mockResolvedValue();
  vi.spyOn(browser.runtime, "sendMessage").mockResolvedValue(undefined);
  const controller = registerRecordingController()!;
  await controller.mirror({ ...initialState, phase: "done" });
  await vi.advanceTimersByTimeAsync(4999);
  expect(close).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(close).toHaveBeenCalledOnce();
  await controller.mirror({
    ...initialState,
    phase: "failed",
    recoveries: [{ sessionId: "pending", createdAt: 1 }],
  });
  await vi.advanceTimersByTimeAsync(6000);
  expect(close).toHaveBeenCalledOnce();
});
it("stops from the shortcut while active and opens the in-page recorder from idle", async () => {
  vi.spyOn(browser.runtime, "sendMessage").mockResolvedValue(undefined);
  vi.spyOn(browser.runtime, "getContexts").mockResolvedValue([{}] as never);
  const inject = vi
    .spyOn(browser.scripting, "executeScript")
    .mockResolvedValue([] as never);
  const controller = registerRecordingController()!;
  await controller.mirror({ ...initialState, phase: "recording" });
  (listeners.command as unknown as (c: string, t: Browser.tabs.Tab) => void)(
    "toggle-recording",
    { id: 4, windowId: 7 } as Browser.tabs.Tab,
  );
  await vi.waitFor(() =>
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      target: "offscreen",
      type: "recording/stop",
    }),
  );
  expect(inject).not.toHaveBeenCalled();
  await controller.mirror({ ...initialState });
  (listeners.command as unknown as (c: string, t: Browser.tabs.Tab) => void)(
    "toggle-recording",
    { id: 4, windowId: 7 } as Browser.tabs.Tab,
  );
  await vi.waitFor(() =>
    expect(inject).toHaveBeenCalledWith({
      target: { tabId: 4 },
      files: ["/recorder-ui.js"],
    }),
  );
});
it("opens a recorder tab when the page refuses scripts, and asks the panel user for the toolbar otherwise", async () => {
  vi.spyOn(browser.runtime, "getContexts").mockResolvedValue([{}] as never);
  const create = vi
    .spyOn(browser.tabs, "create")
    .mockResolvedValue({} as never);
  const inject = vi
    .spyOn(browser.scripting, "executeScript")
    .mockRejectedValue(new Error("Cannot access a chrome:// URL"));
  const controller = registerRecordingController()!;
  expect(
    await controller.openRecorder({ id: 9 } as Browser.tabs.Tab, null),
  ).toBe("fallback");
  expect(create).toHaveBeenCalledWith({
    url: browser.runtime.getURL("/recorder.html"),
  });
  inject.mockRejectedValue(
    new Error(
      "Extension manifest must request permission to access this host.",
    ),
  );
  expect(
    await controller.openRecorder({ id: 9 } as Browser.tabs.Tab, null, "panel"),
  ).toBe("needs-toolbar");
  expect(create).toHaveBeenCalledTimes(1);
  expect(
    isRestrictedPageError(
      new Error("Cannot access chrome:// and edge:// URLs"),
    ),
  ).toBe(true);
  expect(
    isRestrictedPageError(new Error("Cannot access contents of url")),
  ).toBe(false);
});
it("opens the recorder from the toolbar only when a panel Record is waiting for that click", async () => {
  vi.spyOn(browser.runtime, "getContexts").mockResolvedValue([{}] as never);
  const inject = vi
    .spyOn(browser.scripting, "executeScript")
    .mockRejectedValue(
      new Error(
        "Extension manifest must request permission to access this host.",
      ),
    );
  const click = (id: number) =>
    (listeners.click as unknown as (tab: { id: number }) => void)({ id });
  const pending = async () =>
    (await browser.storage.session.get("recording.pendingOpen"))[
      "recording.pendingOpen"
    ];
  const controller = registerRecordingController()!;

  // An idle click is the panel's business (background.ts): no recorder.
  click(9);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(inject).not.toHaveBeenCalled();

  expect(
    await controller.openRecorder({ id: 9 } as Browser.tabs.Tab, null, "panel"),
  ).toBe("needs-toolbar");
  expect(await pending()).toMatchObject({ tabId: 9 });
  expect(inject).toHaveBeenCalledTimes(1);

  // Another tab's click does not spend it.
  click(8);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(inject).toHaveBeenCalledTimes(1);

  // The click the panel asked for grants activeTab and finishes the Record.
  inject.mockResolvedValue([] as never);
  click(9);
  await vi.waitFor(() => expect(inject).toHaveBeenCalledTimes(2));
  expect(inject.mock.calls[1]?.[0]).toMatchObject({ target: { tabId: 9 } });
  await vi.waitFor(async () => expect(await pending()).toBeUndefined());
});
it("starts This tab from a tabCapture stream id and never trusts a page-sent one", async () => {
  vi.spyOn(browser.runtime, "getContexts").mockResolvedValue([{}] as never);
  vi.spyOn(browser.scripting, "executeScript").mockResolvedValue([] as never);
  vi.spyOn(browser.permissions, "contains").mockResolvedValue(true as never);
  const streamId = vi.fn(async () => "fresh-stream");
  Object.assign(browser, { tabCapture: { getMediaStreamId: streamId } });
  const send = vi
    .spyOn(browser.runtime, "sendMessage")
    .mockResolvedValue(undefined);
  const controller = registerRecordingController()!;
  await controller.openRecorder({ id: 5 } as Browser.tabs.Tab, null);
  await dispatch(
    {
      target: "background",
      type: "recording/start",
      settings: {
        ...defaultSettings,
        mode: "tab",
        cameraDeviceId: "cam",
        cameraVisible: true,
        tabStreamId: "forged",
        cameraLayer: "page",
      },
    },
    page("/recorder-bar.html"),
  );
  expect(streamId).toHaveBeenCalledWith({ targetTabId: 5 });
  const forwarded = send.mock.calls
    .map(
      ([message]) =>
        message as {
          type?: string;
          settings?: { tabStreamId: string; cameraLayer: string };
        },
    )
    .find((message) => message.type === "recording/start");
  expect(forwarded?.settings?.tabStreamId).toBe("fresh-stream");
  // No page host is connected in this test, so the compositor draws the camera.
  expect(forwarded?.settings?.cameraLayer).toBe("composite");
});
it("refuses Area without tabCapture and asks the host for a selection when granted", async () => {
  vi.spyOn(browser.runtime, "getContexts").mockResolvedValue([{}] as never);
  vi.spyOn(browser.scripting, "executeScript").mockResolvedValue([] as never);
  const contains = vi
    .spyOn(browser.permissions, "contains")
    .mockResolvedValue(false as never);
  const send = vi
    .spyOn(browser.runtime, "sendMessage")
    .mockResolvedValue(undefined);
  const controller = registerRecordingController()!;
  await controller.openRecorder({ id: 5 } as Browser.tabs.Tab, null);
  const start = {
    target: "background",
    type: "recording/start",
    settings: { ...defaultSettings, mode: "area" },
  };
  await dispatch(start, page("/recorder-bar.html"));
  expect((await controller.readState()).error?.code).toBe(
    "TAB_CAPTURE_REQUIRED",
  );
  contains.mockResolvedValue(true as never);
  await dispatch(start, page("/recorder-bar.html"));
  expect(send).toHaveBeenCalledWith({
    target: "recorder",
    type: "recorder/area",
    status: "selecting",
  });
  expect(
    send.mock.calls.some(
      ([message]) => (message as { type?: string }).type === "recording/start",
    ),
  ).toBe(false);
});
it("starts the area recording even when the worker restarted during the selection", async () => {
  vi.spyOn(browser.runtime, "getContexts").mockResolvedValue([{}] as never);
  vi.spyOn(browser.scripting, "executeScript").mockResolvedValue([] as never);
  vi.spyOn(browser.permissions, "contains").mockResolvedValue(true as never);
  vi.spyOn(browser.tabCapture, "getMediaStreamId").mockResolvedValue(
    "area-stream" as never,
  );
  const send = vi
    .spyOn(browser.runtime, "sendMessage")
    .mockResolvedValue(undefined);
  const first = registerRecordingController()!;
  await first.openRecorder({ id: 5 } as Browser.tabs.Tab, null);
  await dispatch(
    {
      target: "background",
      type: "recording/start",
      settings: { ...defaultSettings, mode: "area" },
    },
    page("/recorder-bar.html"),
  );
  const stored = await browser.storage.session.get("recording.pendingArea");
  expect((stored["recording.pendingArea"] as { mode?: string }).mode).toBe(
    "area",
  );
  // The worker is stopped while the user draws: a fresh controller has no memory of the start.
  registerRecordingController();
  let onPortMessage: ((message: unknown) => void) | undefined;
  const port = {
    name: "recorder-ui",
    sender: { id: browser.runtime.id, tab: { id: 5 } },
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onMessage: {
      addListener: (listener: (message: unknown) => void) =>
        (onPortMessage = listener),
    },
    onDisconnect: { addListener: vi.fn() },
  };
  (listeners.connect as unknown as (p: typeof port) => void)(port);
  const rect = { x: 0.1, y: 0.2, w: 0.5, h: 0.5 };
  onPortMessage?.({ type: "area", rect });
  await vi.waitFor(() => {
    const started = send.mock.calls
      .map(
        ([message]) =>
          message as {
            type?: string;
            settings?: { areaRect?: unknown; tabStreamId?: string };
          },
      )
      .find((message) => message.type === "recording/start");
    expect(started?.settings?.areaRect).toEqual(rect);
    expect(started?.settings?.tabStreamId).toBe("area-stream");
  });
  expect(
    (await browser.storage.session.get("recording.pendingArea"))[
      "recording.pendingArea"
    ],
  ).toBeUndefined();
});
it("restarts a take as a fresh start: cancel, then a new tab stream id for the same area", async () => {
  vi.spyOn(browser.runtime, "getContexts").mockResolvedValue([{}] as never);
  vi.spyOn(browser.scripting, "executeScript").mockResolvedValue([] as never);
  vi.spyOn(browser.permissions, "contains").mockResolvedValue(true as never);
  let streams = 0;
  vi.spyOn(browser.tabCapture, "getMediaStreamId").mockImplementation(
    async () => `stream-${++streams}` as never,
  );
  const controller = registerRecordingController()!;
  // The engine settles to idle after a cancel, as the offscreen document does.
  const send = vi
    .spyOn(browser.runtime, "sendMessage")
    .mockImplementation(async (message: unknown) => {
      if ((message as { type?: string }).type === "recording/cancel")
        setTimeout(() => void controller.mirror({ ...initialState }), 0);
      return undefined;
    });
  await controller.openRecorder({ id: 5 } as Browser.tabs.Tab, null);
  const rect = { x: 0.1, y: 0.2, w: 0.5, h: 0.5 };
  await dispatch(
    {
      target: "background",
      type: "recording/start",
      settings: { ...defaultSettings, mode: "area", areaRect: rect },
    },
    page("/recorder-bar.html"),
  );
  await controller.mirror({ ...initialState, phase: "recording" });
  const before = send.mock.calls.length;
  await dispatch(
    { target: "background", type: "recording/restart" },
    page("/recorder-bar.html"),
  );
  const after = send.mock.calls
    .slice(before)
    .map(
      ([message]) =>
        message as {
          target?: string;
          type?: string;
          state?: { phase: string };
          settings?: { areaRect?: unknown; tabStreamId?: string };
        },
    );
  const types = after.map((message) => message.type);
  expect(types).not.toContain("recording/restart");
  expect(types.indexOf("recording/cancel")).toBeLessThan(
    types.indexOf("recording/start"),
  );
  const restarted = after.find((message) => message.type === "recording/start");
  expect(restarted?.settings?.areaRect).toEqual(rect);
  expect(restarted?.settings?.tabStreamId).toBe("stream-2");
  // The bar shows "starting" between the takes, never the setup bar.
  const shown = after
    .filter(
      (message) =>
        message.target === "recorder" && message.type === "recording/state",
    )
    .map((message) => message.state?.phase);
  expect(shown).toContain("acquiring");
  expect(shown).not.toContain("idle");
});
it("asks for one toolbar click when Chrome refuses the tab, and re-arms on that click", async () => {
  vi.spyOn(browser.runtime, "getContexts").mockResolvedValue([{}] as never);
  vi.spyOn(browser.scripting, "executeScript").mockResolvedValue([] as never);
  vi.spyOn(browser.permissions, "contains").mockResolvedValue(true as never);
  vi.spyOn(browser.tabCapture, "getMediaStreamId").mockRejectedValue(
    new Error("Extension has not been invoked for the current page"),
  );
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const send = vi
    .spyOn(browser.runtime, "sendMessage")
    .mockResolvedValue(undefined);
  const controller = registerRecordingController()!;
  await controller.openRecorder({ id: 5 } as Browser.tabs.Tab, null);
  let onPortMessage: ((message: unknown) => void) | undefined;
  const port = {
    name: "recorder-ui",
    sender: { id: browser.runtime.id, tab: { id: 5 } },
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onMessage: {
      addListener: (listener: (message: unknown) => void) =>
        (onPortMessage = listener),
    },
    onDisconnect: { addListener: vi.fn() },
  };
  (listeners.connect as unknown as (p: typeof port) => void)(port);
  await dispatch(
    {
      target: "background",
      type: "recording/start",
      settings: { ...defaultSettings, mode: "area" },
    },
    page("/recorder-bar.html"),
  );
  onPortMessage?.({ type: "area", rect: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } });
  await vi.waitFor(async () =>
    expect((await controller.readState()).error?.code).toBe(
      "TAB_CAPTURE_INVOKE",
    ),
  );
  expect(
    (await browser.storage.session.get("recording.armTabCapture"))[
      "recording.armTabCapture"
    ],
  ).toBe(5);
  // The click Chrome needs: it re-arms the open recorder instead of closing it.
  (listeners.click as unknown as (tab: { id: number }) => void)({ id: 5 });
  await vi.waitFor(() =>
    expect(send).toHaveBeenCalledWith({
      target: "recorder",
      type: "recorder/tab-capture",
      status: "ready",
    }),
  );
  expect(port.postMessage).not.toHaveBeenCalledWith({ type: "close" });
  expect(
    (await browser.storage.session.get("recording.armTabCapture"))[
      "recording.armTabCapture"
    ],
  ).toBeUndefined();
});
it("accepts commands only from the recorder pages it expects", async () => {
  vi.spyOn(browser.runtime, "getContexts").mockResolvedValue([{}] as never);
  registerRecordingController();
  const close = { target: "background", type: "recorder/close" };
  expect(await dispatch(close, page("/camera-bubble.html"))).toBe("ignored");
  expect(
    await dispatch(close, {
      id: browser.runtime.id,
      url: "https://evil.test/recorder-bar.html",
    }),
  ).toBe("ignored");
  expect(
    await dispatch(
      { target: "background", type: "recorder/open", intent: null },
      page("/recorder-bar.html"),
    ),
  ).toBe("ignored");
  expect(
    await dispatch(
      {
        target: "background",
        type: "engine/api",
        requestId: "r",
        op: "create",
        payload: {},
      },
      page("/recorder-bar.html"),
    ),
  ).toBe("ignored");
});
describe("camera layer and host view", () => {
  const ui: RecorderUi = {
    tabId: 5,
    mode: "tab",
    cameraOn: true,
    captureTabId: 5,
    viewport: null,
  };
  const recording = {
    ...initialState,
    phase: "recording" as const,
    live: { ...initialState.live, cameraVisible: true },
  };
  it("lets the page bubble be the camera wherever it is inside the capture", () => {
    // One-click tab capture: the captured tab is known, nothing is checked.
    expect(cameraLayerFor(ui, 5)).toBe("page");
    expect(cameraLayerFor(ui, null)).toBe("composite");
    expect(cameraLayerFor(ui, 6)).toBe("composite");
    expect(cameraLayerFor({ ...ui, mode: "area" }, 5)).toBe("page");
    expect(cameraLayerFor({ ...ui, captureTabId: null }, 5)).toBe("composite");
    // A picked source says nothing by itself: the compositor draws until the check answers.
    for (const mode of ["window", "screen"] as const) {
      const picked = { ...ui, mode };
      expect(cameraLayerFor(picked, 5)).toBe("composite");
      for (const capture of ["probing", "no", "unknown"] as const)
        expect(cameraLayerFor(picked, 5, true, capture)).toBe("composite");
      // Found in the frames: the bubble is the camera, while its tab is showing.
      expect(cameraLayerFor(picked, 5, true, "yes")).toBe("page");
      expect(cameraLayerFor(picked, 5, false, "yes")).toBe("composite");
      expect(cameraLayerFor(picked, null, true, "yes")).toBe("composite");
    }
    // This tab through the picker: checked too. A captured tab renders even in the background.
    expect(cameraLayerFor(ui, 5, false, "yes")).toBe("page");
    expect(cameraLayerFor(ui, 5, true, "no")).toBe("composite");
    expect(cameraLayerFor(ui, 5, true, "unknown")).toBe("composite");
  });
  it("marks only the setup stage as setup, where the panel offers the blur", () => {
    expect(hostView(initialState, ui, false, 5).setup).toBe(true);
    expect(
      hostView({ ...initialState, phase: "failed" }, ui, false, 5).setup,
    ).toBe(true);
    expect(hostView(recording, ui, false, 5).setup).toBe(false);
    expect(
      hostView({ ...initialState, phase: "countdown" }, ui, false, 5).setup,
    ).toBe(false);
  });
  it("keeps the bubble in a Window or Display take, with the camera in the video once", () => {
    for (const mode of ["window", "screen"] as const) {
      const picked = { ...ui, mode };
      const view = (
        phase: typeof initialState.phase,
        bubbleInCapture: typeof initialState.bubbleInCapture,
        visible = true,
      ) =>
        hostView(
          { ...recording, phase, bubbleInCapture },
          picked,
          false,
          5,
          visible,
        );
      // Setup, the pick and the check itself: the bubble is up, the marker only while checking.
      for (const phase of ["idle", "acquiring", "picking"] as const)
        expect(view(phase, "assumed")).toMatchObject({
          bubble: true,
          marker: false,
        });
      for (const phase of ["creating", "countdown"] as const)
        expect(view(phase, "probing")).toMatchObject({
          bubble: true,
          marker: true,
        });
      for (const phase of ["countdown", "recording", "paused"] as const) {
        // Inside the capture: the bubble is the camera (cameraLayerFor gives "page").
        expect(view(phase, "yes")).toMatchObject({ bubble: true, marker: false });
        // Outside it: the compositor draws the camera, the bubble is the user's own view.
        expect(view(phase, "no")).toMatchObject({ bubble: true, marker: false });
        // Nobody could tell: it leaves before the first frame, and the compositor draws.
        expect(view(phase, "unknown")).toMatchObject({
          bubble: false,
          marker: false,
        });
      }
      // Inside the capture but its tab is hidden: the compositor took over, no bubble.
      expect(view("recording", "yes", false).bubble).toBe(false);
      expect(view("uploading", "yes").bubble).toBe(false);
      // A hidden camera has no bubble in any case.
      expect(
        hostView(
          {
            ...recording,
            bubbleInCapture: "no",
            live: { ...recording.live, cameraVisible: false },
          },
          picked,
          false,
          5,
        ).bubble,
      ).toBe(false);
    }
    // One-click tab capture never shows the marker.
    expect(
      hostView({ ...recording, phase: "countdown" }, ui, false, 5),
    ).toMatchObject({ bubble: true, marker: false });
  });
  it("keeps the bubble on screen while recording, and the camera in the video once", () => {
    expect(hostView(initialState, ui, false, 5).bubble).toBe(true);
    expect(hostView(recording, ui, false, 5).bubble).toBe(true);
    expect(hostView(recording, { ...ui, mode: "area" }, false, 5).bubble).toBe(
      true,
    );
    expect(hostView(recording, ui, false, 6).bubble).toBe(false);
    expect(
      hostView({ ...initialState, phase: "uploading" }, ui, false, 5).bubble,
    ).toBe(false);
    expect(
      hostView(initialState, { ...ui, cameraOn: false }, false, 5).bubble,
    ).toBe(false);
    // A failed start shows the setup bar again, with the camera.
    expect(
      hostView({ ...initialState, phase: "failed" }, ui, false, 5).bubble,
    ).toBe(true);
    const selecting = hostView(initialState, ui, true, 5);
    // The camera stays up while choosing an area: the host snaps it inside the selection.
    expect(selecting).toMatchObject({
      bar: false,
      bubble: true,
      selectArea: true,
    });
    expect(
      hostView(
        { ...initialState, phase: "countdown", countdown: 2 },
        ui,
        false,
        5,
      ).countdown,
    ).toBe(2);
  });
});
describe("worker diagnostics", () => {
  it("reports a failed UI call once and returns its ref, status and request id", async () => {
    vi.spyOn(browser.runtime, "getContexts").mockResolvedValue([{}] as never);
    vi.spyOn(videosService, "getLimits").mockRejectedValue(
      new ApiClientError(
        "Your session is no longer available.",
        "videos.getLimits",
        401,
        "NO_SESSION",
      ),
    );
    registerRecordingController();

    const reply = await dispatch(
      {
        target: "background",
        type: "engine/api",
        requestId: "r1",
        op: "getLimits",
        payload: {},
      },
      page("/sidepanel.html"),
    );

    expect(reply).toMatchObject({
      target: "sidepanel",
      type: "api/result",
      requestId: "r1",
      ok: false,
      error: {
        code: "NO_SESSION",
        ref: expect.stringMatching(/^E-[0-9A-Z]{6}$/),
        status: 401,
      },
    });
    await whenPersisted();
    const [logged] = await errorLogItem.getValue();
    expect(logged).toMatchObject({
      ref: (reply as { error: { ref: string } }).error.ref,
      surface: "worker",
      code: "NO_SESSION",
      operation: "videos.getLimits",
      meta: { caller: "ui" },
    });
  });

});
