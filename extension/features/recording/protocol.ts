import { z } from "zod";
import { ZOOM_RANGE } from "./host-layout";

export const cornerSchema = z.enum([
  "bottom-left",
  "bottom-right",
  "top-left",
  "top-right",
]);
export const sizeSchema = z.enum(["sm", "md", "lg"]);
/** 0 is a square camera, 1 a circle. */
export const roundnessSchema = z.number().min(0).max(1);
export const zoomSchema = z.number().min(ZOOM_RANGE.min).max(ZOOM_RANGE.max);
/** Which layer draws the camera: the live page bubble (captured with the tab) or the compositor. */
export const cameraLayerSchema = z.enum(["page", "composite"]);
export const rectSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().positive().max(1),
    h: z.number().positive().max(1),
  })
  .refine((r) => r.x + r.w <= 1.000001 && r.y + r.h <= 1.000001);
export const settingsSchema = z.object({
  mode: z.enum(["screen", "window", "tab", "area"]),
  micDeviceId: z.string().nullable(),
  cameraDeviceId: z.string().nullable(),
  cameraVisible: z.boolean(),
  bubbleCorner: cornerSchema,
  bubbleSize: sizeSchema,
  bubbleRoundness: roundnessSchema.default(1),
  bubbleZoom: zoomSchema.default(1),
  includeDisplayAudio: z.boolean(),
  countdown: z.boolean(),
  title: z.string().max(120).nullable(),
  jobSnapshotId: z.uuid().nullable(),
  /** Area mode: the crop, normalized to the captured tab's viewport. */
  areaRect: rectSchema.nullable().default(null),
  /** Set only by the worker, from `tabCapture.getMediaStreamId`. Never trusted from a page. */
  tabStreamId: z.string().min(1).max(512).nullable().default(null),
  /**
   * The captured tab's viewport in device pixels, set by the worker from the page host. Tab
   * capture asks for exactly this size: larger limits make Chrome letterbox the frames and
   * re-render the tab at a capture scale.
   */
  tabSize: z
    .object({
      w: z.number().int().min(160).max(7680),
      h: z.number().int().min(90).max(4320),
    })
    .nullable()
    .default(null),
  /**
   * The host page's geometry, set by the worker from the page host and the tab's zoom. The
   * compositor draws its camera at the page bubble's own size with it, so the camera keeps its
   * size when the compositor takes over from a page bubble that left the capture
   * (see `framePxPerCss` in engine/layout.ts).
   */
  pageGeometry: z
    .object({
      /** `innerWidth`, in CSS pixels. */
      innerW: z.number().positive().max(20_000),
      /** `outerWidth` (the browser window), in DIPs. */
      outerW: z.number().positive().max(20_000),
      /** `screen.width`, in DIPs. */
      screenW: z.number().positive().max(20_000),
      /** The tab's zoom: CSS pixels to DIPs. */
      zoom: z.number().min(0.25).max(5),
    })
    .nullable()
    .default(null),
  cameraLayer: cameraLayerSchema.default("composite"),
});
export const liveSchema = z.object({
  micMuted: z.boolean().optional(),
  cameraVisible: z.boolean().optional(),
  bubbleCorner: cornerSchema.optional(),
  bubbleSize: sizeSchema.optional(),
  bubbleRoundness: roundnessSchema.optional(),
  bubbleZoom: zoomSchema.optional(),
  cameraLayer: cameraLayerSchema.optional(),
});
/**
 * Whether the page bubble is inside what is being captured.
 * - "assumed": one-click tab capture, where the captured tab is known. No check is made.
 * - "probing": a source from the browser's picker; the marker check is running.
 * - "yes" / "no": the check's answer. "unknown": it could not tell.
 */
export const bubbleInCaptureSchema = z.enum([
  "assumed",
  "probing",
  "yes",
  "no",
  "unknown",
]);
export type BubbleInCapture = z.infer<typeof bubbleInCaptureSchema>;
export const phaseSchema = z.enum([
  "idle",
  "acquiring",
  "picking",
  "selecting-area",
  "creating",
  "countdown",
  "recording",
  "paused",
  "stopping",
  "uploading",
  "completing",
  "done",
  "failed",
]);
export const stateSchema = z.object({
  phase: phaseSchema,
  sessionId: z.string().nullable(),
  videoId: z.uuid().nullable(),
  shareUrl: z.url().nullable(),
  startedAt: z.number().nullable(),
  elapsedMs: z.number().nonnegative(),
  maxDurationMs: z.number().positive().nullable(),
  live: z.object({
    micMuted: z.boolean(),
    cameraVisible: z.boolean(),
    bubbleCorner: cornerSchema,
    bubbleSize: sizeSchema,
    bubbleRoundness: roundnessSchema.default(1),
    bubbleZoom: zoomSchema.default(1),
    cameraLayer: cameraLayerSchema.default("composite"),
  }),
  bytesRecorded: z.number().nonnegative(),
  bytesUploaded: z.number().nonnegative(),
  uploadHealthy: z.boolean(),
  error: z
    .object({
      code: z.string(),
      messageKey: z.string(),
      /** The diagnostics ref the worker reported this failure under. */
      ref: z.string().optional(),
    })
    .nullable(),
  updatedAt: z.number().default(0),
  countdown: z.number().int().min(0).max(3).default(0),
  bubbleInCapture: bubbleInCaptureSchema.default("assumed"),
  warnings: z.array(z.enum(["microphone", "camera", "limit"])).default([]),
  recoveries: z
    .array(z.object({ sessionId: z.string(), createdAt: z.number() }))
    .default([]),
});
export type RecordingSettings = z.infer<typeof settingsSchema>;
export type RecordingMode = RecordingSettings["mode"];
export type BubbleCorner = z.infer<typeof cornerSchema>;
export type BubbleSize = z.infer<typeof sizeSchema>;
export type LiveUpdate = z.infer<typeof liveSchema>;
export type SessionPhase = z.infer<typeof phaseSchema>;
export type SessionState = z.infer<typeof stateSchema>;
export type NormalizedRect = z.infer<typeof rectSchema>;
export type CameraLayer = z.infer<typeof cameraLayerSchema>;
export const initialState: SessionState = {
  phase: "idle",
  sessionId: null,
  videoId: null,
  shareUrl: null,
  startedAt: null,
  elapsedMs: 0,
  maxDurationMs: null,
  live: {
    micMuted: false,
    cameraVisible: false,
    bubbleCorner: "bottom-right",
    bubbleSize: "md",
    bubbleRoundness: 1,
    bubbleZoom: 1,
    cameraLayer: "composite",
  },
  bytesRecorded: 0,
  bytesUploaded: 0,
  uploadHealthy: true,
  error: null,
  updatedAt: 0,
  countdown: 0,
  bubbleInCapture: "assumed",
  warnings: [],
  recoveries: [],
};
export const defaultSettings: RecordingSettings = {
  mode: "tab",
  micDeviceId: null,
  cameraDeviceId: null,
  cameraVisible: true,
  bubbleCorner: "bottom-right",
  bubbleSize: "md",
  bubbleRoundness: 1,
  bubbleZoom: 1,
  includeDisplayAudio: false,
  countdown: true,
  title: null,
  jobSnapshotId: null,
  areaRect: null,
  tabStreamId: null,
  tabSize: null,
  pageGeometry: null,
  cameraLayer: "composite",
};
const commands = [
  z.object({ type: z.literal("recording/start"), settings: settingsSchema }),
  ...(
    [
      "pause",
      "resume",
      "stop",
      "cancel",
      "restart",
      "get-state",
      "skip-countdown",
      "reset",
    ] as const
  ).map((type) => z.object({ type: z.literal(`recording/${type}`) })),
  z.object({ type: z.literal("recording/live"), update: liveSchema }),
  z.object({
    type: z.literal("recording/recover"),
    sessionId: z.string(),
    action: z.enum(["upload", "discard"]),
  }),
] as const;
export const apiRequestSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("getLimits"), payload: z.object({}) }),
  z.object({
    op: z.literal("create"),
    payload: z.object({
      title: z.string().trim().min(1).max(120).optional(),
      sourceKind: z.enum(["screen", "window", "tab", "area"]),
      hasCamera: z.boolean(),
      hasAudio: z.boolean(),
      mimeType: z.literal("video/mp4"),
      jobSnapshotId: z.uuid().nullable().optional(),
    }),
  }),
  z.object({
    op: z.literal("presignParts"),
    payload: z.object({
      videoId: z.uuid(),
      partNumbers: z.array(z.number().int().positive()).min(1).max(10),
    }),
  }),
  z.object({
    op: z.literal("listUploadedParts"),
    payload: z.object({ videoId: z.uuid() }),
  }),
  z.object({
    op: z.literal("complete"),
    payload: z.object({
      videoId: z.uuid(),
      parts: z.array(
        z.object({
          partNumber: z.number().int().positive(),
          etag: z.string().min(1),
        }),
      ),
      clientDurationMs: z.number().nonnegative(),
    }),
  }),
  z.object({
    op: z.literal("abortUpload"),
    payload: z.object({ videoId: z.uuid() }),
  }),
  // Side-panel JSON calls use the same authenticated worker broker.
  z.object({
    op: z.literal("list"),
    payload: z.object({
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
      jobSnapshotId: z.uuid().optional(),
    }),
  }),
  z.object({ op: z.literal("get"), payload: z.object({ videoId: z.uuid() }) }),
  z.object({
    op: z.literal("rename"),
    payload: z.object({
      videoId: z.uuid(),
      title: z.string().trim().min(1).max(120),
    }),
  }),
  z.object({
    op: z.literal("remove"),
    payload: z.object({ videoId: z.uuid() }),
  }),
]);
export type ApiRequest = z.infer<typeof apiRequestSchema>;
export type EngineApiOp = ApiRequest["op"];
/** Only an http(s) share link may be copied: never `javascript:` or other schemes. */
const shareLinkSchema = z.url({ protocol: /^https?$/ }).max(2048);
export const intentSchema = z.object({
  jobSnapshotId: z.uuid(),
  title: z.string().trim().min(1).max(120),
});
export type RecorderIntent = z.infer<typeof intentSchema>;
/**
 * A panel Record refused for want of `activeTab` (a panel opened from the Upwork launcher).
 * The next toolbar click on that tab grants it, and the worker opens the recorder then. Kept in
 * `storage.session` so the panel can see when it has been spent.
 */
export const PENDING_OPEN_KEY = "recording.pendingOpen";
/** Long enough to find the icon, short enough that a later click is not surprised by it. */
export const PENDING_OPEN_TTL_MS = 10 * 60_000;
export const pendingOpenSchema = z.object({
  tabId: z.number().int(),
  requestedAt: z.number(),
});
/** Messages the recorder UI (bar frame, side panel, fallback page) sends to the worker. */
const recorderCommands = [
  z.object({
    type: z.literal("recorder/open"),
    intent: intentSchema.nullable(),
  }),
  z.object({ type: z.literal("recorder/close") }),
  z.object({
    type: z.literal("recorder/preview"),
    cameraDeviceId: z.string().max(512).nullable(),
    micDeviceId: z.string().max(512).nullable(),
    mode: settingsSchema.shape.mode,
    blur: z.boolean().default(false),
  }),
  z.object({ type: z.literal("recorder/refresh-devices") }),
  z.object({ type: z.literal("recorder/copy"), text: shareLinkSchema }),
  /** tabCapture was just granted: the next toolbar click re-arms instead of closing. */
  z.object({ type: z.literal("recorder/arm-tab-capture") }),
] as const;
export const deviceSchema = z.object({
  kind: z.enum(["audioinput", "videoinput"]),
  deviceId: z.string().min(1).max(512),
  label: z.string().max(256),
});
export type MediaDevice = z.infer<typeof deviceSchema>;
const permissionState = z.enum(["granted", "denied", "prompt"]);
export const previewSnapshotSchema = z.object({
  devices: z.array(deviceSchema).max(64),
  permissions: z.object({ camera: permissionState, microphone: permissionState }),
});
export type PreviewSnapshot = z.infer<typeof previewSnapshotSchema>;
const sdpSchema = z.object({
  type: z.enum(["offer", "answer"]),
  sdp: z.string().max(20_000),
});
const iceSchema = z.object({
  candidate: z.string().max(2_000),
  sdpMid: z.string().max(64).nullable().optional(),
  sdpMLineIndex: z.number().int().min(0).max(64).nullable().optional(),
  usernameFragment: z.string().max(256).nullable().optional(),
});
const peerId = z.uuid();
/** Camera bubble frame -> offscreen document: the local preview connection. */
export const rtcToOffscreen = z.union([
  z.object({ type: z.literal("rtc/hello"), peer: peerId }),
  z.object({ type: z.literal("rtc/answer"), peer: peerId, sdp: sdpSchema }),
  z.object({ type: z.literal("rtc/ice"), peer: peerId, candidate: iceSchema }),
  z.object({ type: z.literal("rtc/bye"), peer: peerId }),
]);
const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  /** Diagnostics ref, HTTP status and API request id, set by the worker. */
  ref: z.string().optional(),
  status: z.number().int().optional(),
  apiRequestId: z.string().optional(),
});
const apiResult = z.object({
  type: z.literal("api/result"),
  requestId: z.string(),
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.optional(),
});
export const backgroundSchema = z.intersection(
  z.object({ target: z.literal("background") }),
  z.union([
    ...commands,
    ...recorderCommands,
    z.object({ type: z.literal("engine/state"), state: stateSchema }),
    z.intersection(
      z.object({ type: z.literal("engine/api"), requestId: z.string() }),
      apiRequestSchema,
    ),
    z.object({ type: z.literal("engine/closed") }),
    z.object({
      type: z.literal("media-permission/result"),
      camera: z.enum(["granted", "denied", "prompt"]),
      microphone: z.enum(["granted", "denied", "prompt"]),
    }),
  ]),
);
export const offscreenSchema = z.intersection(
  z.object({ target: z.literal("offscreen") }),
  z.union([
    ...commands,
    apiResult,
    /** The page host painted the marker of the marker check (see engine/marker-probe.ts). */
    z.object({ type: z.literal("recording/marker-shown") }),
    z.object({
      type: z.literal("preview/configure"),
      cameraDeviceId: z.string().max(512).nullable(),
      micDeviceId: z.string().max(512).nullable(),
      blur: z.boolean().default(false),
    }),
    z.object({ type: z.literal("preview/refresh") }),
    z.object({ type: z.literal("clipboard/write"), text: shareLinkSchema }),
    rtcToOffscreen,
  ]),
);
/** Broadcasts the bar frame, the fallback page and the side panel listen to. */
export const recorderSchema = z.intersection(
  z.object({ target: z.literal("recorder") }),
  z.union([
    z.object({ type: z.literal("recording/state"), state: stateSchema }),
    z.object({
      type: z.literal("preview/devices"),
      snapshot: previewSnapshotSchema,
    }),
    z.object({ type: z.literal("preview/level"), level: z.number().min(0).max(1) }),
    z.object({
      type: z.literal("preview/blur"),
      status: z.enum(["off", "loading", "on", "unavailable"]),
      reason: z.string().max(200).optional(),
    }),
    z.object({
      type: z.literal("recorder/area"),
      status: z.enum(["selecting", "cancelled"]),
    }),
    z.object({ type: z.literal("recorder/tab-capture"), status: z.literal("ready") }),
  ]),
);
/** Offscreen document -> camera bubble frame. */
export const bubbleSchema = z.intersection(
  z.object({ target: z.literal("bubble") }),
  z.union([
    z.object({ type: z.literal("rtc/offer"), peer: peerId, sdp: sdpSchema }),
    z.object({ type: z.literal("rtc/ice"), peer: peerId, candidate: iceSchema }),
    z.object({ type: z.literal("rtc/available") }),
    z.object({ type: z.literal("rtc/ended") }),
  ]),
);
/** Worker <-> injected page host, over the `recorder-ui` port. */
export const hostViewSchema = z.object({
  type: z.literal("view"),
  bar: z.boolean(),
  bubble: z.boolean(),
  countdown: z.number().int().min(0).max(3),
  selectArea: z.boolean(),
  /** The setup stage, before Start: settings that only apply before recording are offered. */
  setup: z.boolean(),
  /** The marker check is running: the host flashes its marker on the bubble. */
  marker: z.boolean().default(false),
});
export type HostView = z.infer<typeof hostViewSchema>;
export const workerToHostSchema = z.union([
  hostViewSchema,
  z.object({ type: z.literal("close") }),
]);
export const viewportSchema = z.object({
  w: z.number().int().min(1).max(10_000),
  h: z.number().int().min(1).max(10_000),
  dpr: z.number().min(0.25).max(8),
  /** `outerWidth` and `screen.width`, in DIPs: what a picked window or screen spans. */
  outerW: z.number().int().min(1).max(20_000).optional(),
  screenW: z.number().int().min(1).max(20_000).optional(),
});
export const hostToWorkerSchema = z.union([
  z.object({ type: z.literal("viewport"), viewport: viewportSchema }),
  z.object({ type: z.literal("visibility"), visible: z.boolean() }),
  z.object({ type: z.literal("area"), rect: rectSchema.nullable() }),
  z.object({
    type: z.literal("bubble"),
    corner: cornerSchema,
    size: sizeSchema,
    roundness: roundnessSchema,
    zoom: zoomSchema.default(1),
  }),
  z.object({ type: z.literal("skip-countdown") }),
  /** The marker is painted and the page is visible. */
  z.object({ type: z.literal("marker-shown") }),
  z.object({ type: z.literal("close") }),
]);
export const sidepanelSchema = z.intersection(
  z.object({ target: z.literal("sidepanel") }),
  z.union([
    z.object({ type: z.literal("recording/state"), state: stateSchema }),
    apiResult,
  ]),
);
export type BackgroundMessage = z.infer<typeof backgroundSchema>;
export type OffscreenMessage = z.infer<typeof offscreenSchema>;
export function parseMessage<T>(
  schema: z.ZodType<T>,
  value: unknown,
): T | null {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
export function isRecordingMessage(value: unknown): boolean {
  return typeof value === "object" && value !== null && "target" in value;
}
