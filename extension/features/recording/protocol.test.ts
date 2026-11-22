import { expect, it } from "vitest";
import {
  backgroundSchema,
  bubbleSchema,
  hostToWorkerSchema,
  offscreenSchema,
  recorderSchema,
  sidepanelSchema,
  defaultSettings,
  initialState,
  parseMessage,
} from "./protocol";
const uuid = "018f6a77-4e90-7ab5-a3bf-15c8f850fa13";
it("validates every command for its target and rejects the wrong target", () => {
  const commands = [
    { type: "recording/start", settings: defaultSettings },
    ...[
      "pause",
      "resume",
      "stop",
      "cancel",
      "restart",
      "get-state",
      "skip-countdown",
    ].map(
      (v) => ({ type: `recording/${v}` }),
    ),
    { type: "recording/live", update: { micMuted: true } },
    { type: "recording/recover", sessionId: uuid, action: "upload" },
  ];
  for (const command of commands) {
    expect(
      parseMessage(backgroundSchema, { ...command, target: "background" }),
    ).not.toBeNull();
    expect(
      parseMessage(offscreenSchema, { ...command, target: "offscreen" }),
    ).not.toBeNull();
    expect(
      parseMessage(sidepanelSchema, { ...command, target: "background" }),
    ).toBeNull();
  }
});
it("parses events, API results, area and permission messages", () => {
  for (const message of [
    { type: "engine/state", state: initialState },
    { type: "engine/api", requestId: uuid, op: "getLimits", payload: {} },
    { type: "engine/closed" },
    { type: "recorder/open", intent: null },
    { type: "recorder/open", intent: { jobSnapshotId: uuid, title: "Job" } },
    { type: "recorder/close" },
    {
      type: "recorder/preview",
      cameraDeviceId: "cam",
      micDeviceId: null,
      mode: "tab",
    },
    { type: "recorder/refresh-devices" },
    { type: "recorder/copy", text: "https://upwin.example.com/v/abcdefghijkl" },
    {
      type: "media-permission/result",
      camera: "denied",
      microphone: "granted",
    },
  ])
    expect(
      backgroundSchema.safeParse({ ...message, target: "background" }).success,
    ).toBe(true);
  for (const target of ["offscreen", "sidepanel"]) {
    const schema = target === "offscreen" ? offscreenSchema : sidepanelSchema;
    expect(
      schema.safeParse({
        target,
        type: "api/result",
        requestId: uuid,
        ok: false,
        error: { code: "VIDEO_TOO_LARGE", message: "Too large" },
      }).success,
    ).toBe(true);
  }
  expect(
    sidepanelSchema.safeParse({
      target: "sidepanel",
      type: "recording/state",
      state: initialState,
    }).success,
  ).toBe(true);
  for (const message of [
    { type: "recording/state", state: initialState },
    {
      type: "preview/devices",
      snapshot: {
        devices: [{ kind: "videoinput", deviceId: "cam", label: "FaceTime HD" }],
        permissions: { camera: "granted", microphone: "prompt" },
      },
    },
    { type: "preview/level", level: 0.4 },
    { type: "recorder/area", status: "selecting" },
    { type: "preview/blur", status: "loading" },
  ])
    expect(
      recorderSchema.safeParse({ ...message, target: "recorder" }).success,
    ).toBe(true);
  for (const message of [
    { type: "rtc/hello", peer: uuid },
    { type: "rtc/answer", peer: uuid, sdp: { type: "answer", sdp: "v=0" } },
    { type: "rtc/ice", peer: uuid, candidate: { candidate: "c", sdpMid: "0" } },
    { type: "preview/configure", cameraDeviceId: null, micDeviceId: "mic" },
    { type: "clipboard/write", text: "https://upwin.example.com/v/abcdefghijkl" },
    { type: "recording/skip-countdown" },
  ])
    expect(
      offscreenSchema.safeParse({ ...message, target: "offscreen" }).success,
    ).toBe(true);
  expect(
    bubbleSchema.safeParse({
      target: "bubble",
      type: "rtc/offer",
      peer: uuid,
      sdp: { type: "offer", sdp: "v=0" },
    }).success,
  ).toBe(true);
  expect(
    hostToWorkerSchema.safeParse({
      type: "area",
      rect: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    }).success,
  ).toBe(true);
});
it("rejects a page-provided clipboard payload that is not a URL, and oversized SDP", () => {
  expect(
    backgroundSchema.safeParse({
      target: "background",
      type: "recorder/copy",
      text: "javascript:alert(1) not a url",
    }).success,
  ).toBe(false);
  expect(
    offscreenSchema.safeParse({
      target: "offscreen",
      type: "rtc/answer",
      peer: uuid,
      sdp: { type: "answer", sdp: "x".repeat(20_001) },
    }).success,
  ).toBe(false);
});
it("rejects malformed settings, area bounds and API operations", () => {
  for (const settings of [
    { ...defaultSettings, mode: "desktop" },
    { ...defaultSettings, title: "x".repeat(121) },
    { ...defaultSettings, micDeviceId: 42 },
  ])
    expect(
      backgroundSchema.safeParse({
        target: "background",
        type: "recording/start",
        settings,
      }).success,
    ).toBe(false);
  expect(
    backgroundSchema.safeParse({
      target: "background",
      type: "recording/start",
      settings: { ...defaultSettings, mode: "area", areaRect: { x: 0.8, y: 0, w: 0.5, h: 1 } },
    }).success,
  ).toBe(false);
  expect(
    hostToWorkerSchema.safeParse({
      type: "area",
      rect: { x: 0.8, y: 0, w: 0.5, h: 1 },
    }).success,
  ).toBe(false);
  expect(
    backgroundSchema.safeParse({
      target: "background",
      type: "engine/api",
      requestId: uuid,
      op: "fetch",
      payload: { url: "https://other.test" },
    }).success,
  ).toBe(false);
});
