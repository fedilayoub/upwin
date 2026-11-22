import { expect, it, vi } from "vitest";
import { Preview, usableDevices } from "./preview";

const device = (kind: MediaDeviceKind, deviceId: string, label: string) =>
  ({ kind, deviceId, label, groupId: "", toJSON: () => ({}) }) as MediaDeviceInfo;
function track(kind: "audio" | "video") {
  return { kind, stop: vi.fn() } as unknown as MediaStreamTrack;
}
function stream(t: MediaStreamTrack) {
  return {
    getTracks: () => [t],
    getVideoTracks: () => (t.kind === "video" ? [t] : []),
    getAudioTracks: () => (t.kind === "audio" ? [t] : []),
  } as unknown as MediaStream;
}
function fixture() {
  const toRecorder = vi.fn(),
    toBubble = vi.fn(),
    camera = track("video"),
    mic = track("audio"),
    stopMeter = vi.fn();
  const peer = {
    addTrack: vi.fn(),
    createOffer: vi.fn(async () => ({ type: "offer", sdp: "v=0" })),
    setLocalDescription: vi.fn(async () => undefined),
    setRemoteDescription: vi.fn(async () => undefined),
    addIceCandidate: vi.fn(async () => undefined),
    close: vi.fn(),
    localDescription: { sdp: "v=0" },
    onicecandidate: null,
  };
  const preview = new Preview(
    { toRecorder, toBubble },
    {
      acquireCamera: vi.fn(async () => stream(camera)),
      acquireMic: vi.fn(async () => stream(mic)),
      enumerate: vi.fn(async () => [
        device("videoinput", "cam", "FaceTime HD"),
        device("audioinput", "", ""),
        device("audiooutput", "out", "Speakers"),
      ]),
      permission: vi.fn(async () => "granted" as PermissionState),
      peer: () => peer as unknown as RTCPeerConnection,
      meter: vi.fn(() => stopMeter),
    },
  );
  return { preview, toRecorder, toBubble, camera, mic, peer, stopMeter };
}

it("hides the placeholder devices Chrome lists before a grant", () => {
  expect(
    usableDevices([
      device("audioinput", "", ""),
      device("videoinput", "abc", ""),
      device("videoinput", "cam", "FaceTime HD"),
      device("audiooutput", "out", "Speakers"),
    ]),
  ).toEqual([{ kind: "videoinput", deviceId: "cam", label: "FaceTime HD" }]);
});
it("re-reports devices after every configure, so labels appear right after a grant", async () => {
  const f = fixture();
  await f.preview.configure(null, null);
  expect(f.toRecorder).toHaveBeenCalledWith({
    target: "recorder",
    type: "preview/devices",
    snapshot: {
      devices: [{ kind: "videoinput", deviceId: "cam", label: "FaceTime HD" }],
      permissions: { camera: "granted", microphone: "granted" },
    },
  });
});
it("offers the camera to a bubble only while it is on, and releases every track on stop", async () => {
  const f = fixture();
  await f.preview.hello("018f6a77-4e90-7ab5-a3bf-15c8f850fa13");
  expect(f.toBubble).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: "rtc/offer" }),
  );
  await f.preview.configure("cam", "mic");
  expect(f.toBubble).toHaveBeenCalledWith({ target: "bubble", type: "rtc/available" });
  await f.preview.hello("018f6a77-4e90-7ab5-a3bf-15c8f850fa13");
  expect(f.peer.addTrack).toHaveBeenCalledWith(f.camera, expect.anything());
  expect(f.toBubble).toHaveBeenCalledWith(
    expect.objectContaining({ type: "rtc/offer", sdp: { type: "offer", sdp: "v=0" } }),
  );
  f.preview.stop();
  expect(f.camera.stop).toHaveBeenCalled();
  expect(f.mic.stop).toHaveBeenCalled();
  expect(f.stopMeter).toHaveBeenCalled();
  expect(f.peer.close).toHaveBeenCalled();
  expect(f.preview.active).toBe(false);
});
it("turns the mic preview off without touching the camera", async () => {
  const f = fixture();
  await f.preview.configure("cam", "mic");
  await f.preview.configure("cam", null);
  expect(f.mic.stop).toHaveBeenCalled();
  expect(f.camera.stop).not.toHaveBeenCalled();
});
