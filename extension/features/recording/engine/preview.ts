import type { MediaDevice, PreviewSnapshot } from "../protocol";
import { acquireCamera, acquireMic, releaseAll } from "./sources";

/**
 * Live camera/mic preview for the in-page recorder, hosted in the offscreen document.
 *
 * Page iframes cannot use the camera under the extension's grant: Chrome keys an embedded
 * frame's permission to the top-level site. So the preview is captured here and
 * the camera is sent to the bubble frame over a local RTCPeerConnection; the bar frame gets
 * devices and mic levels as plain messages.
 */
export interface PreviewTransport {
  toRecorder(message: unknown): void;
  toBubble(message: unknown): void;
}
export interface PreviewDependencies {
  /** The shared camera (the offscreen hub). Its clones are stopped here; `releaseCamera` frees it. */
  acquireCamera: typeof acquireCamera;
  releaseCamera: () => void;
  setBlur: (on: boolean) => Promise<void>;
  acquireMic: typeof acquireMic;
  enumerate: () => Promise<MediaDeviceInfo[]>;
  permission: (name: "camera" | "microphone") => Promise<PermissionState>;
  peer: () => RTCPeerConnection;
  meter: (track: MediaStreamTrack, onLevel: (level: number) => void) => () => void;
}
const defaults: PreviewDependencies = {
  acquireCamera,
  releaseCamera: () => undefined,
  setBlur: async () => undefined,
  acquireMic,
  enumerate: () => navigator.mediaDevices.enumerateDevices(),
  permission: async (name) => {
    try {
      return (await navigator.permissions.query({ name: name as PermissionName }))
        .state;
    } catch {
      return "prompt";
    }
  },
  peer: () => new RTCPeerConnection(),
  meter: levelMeter,
};

/** Usable devices only: before a grant Chrome lists placeholders with empty id and label. */
export function usableDevices(devices: MediaDeviceInfo[]): MediaDevice[] {
  return devices
    .filter(
      (d): d is MediaDeviceInfo & { kind: "audioinput" | "videoinput" } =>
        (d.kind === "audioinput" || d.kind === "videoinput") &&
        d.deviceId !== "" &&
        d.label !== "",
    )
    .map((d) => ({
      kind: d.kind,
      deviceId: d.deviceId.slice(0, 512),
      label: d.label.slice(0, 256),
    }));
}

export class Preview {
  private camera: MediaStream | null = null;
  private mic: MediaStream | null = null;
  private cameraId: string | null = null;
  private micId: string | null = null;
  private stopMeter?: () => void;
  private peers = new Map<string, RTCPeerConnection>();
  private generation = 0;
  private deps: PreviewDependencies;
  constructor(
    private transport: PreviewTransport,
    overrides: Partial<PreviewDependencies> = {},
  ) {
    this.deps = { ...defaults, ...overrides };
  }

  get active() {
    return !!this.camera || !!this.mic;
  }

  async snapshot(): Promise<PreviewSnapshot> {
    const [devices, camera, microphone] = await Promise.all([
      this.deps.enumerate().catch(() => []),
      this.deps.permission("camera"),
      this.deps.permission("microphone"),
    ]);
    return { devices: usableDevices(devices), permissions: { camera, microphone } };
  }

  async publishDevices() {
    this.transport.toRecorder({
      target: "recorder",
      type: "preview/devices",
      snapshot: await this.snapshot(),
    });
  }

  /** Turn the camera and mic previews on or off. Only a user action in the bar calls this. */
  async configure(
    cameraDeviceId: string | null,
    micDeviceId: string | null,
    blur = false,
  ) {
    const generation = ++this.generation;
    // The blur lives on the shared camera, so the recording gets it too.
    void this.deps.setBlur(blur && !!cameraDeviceId);
    if (cameraDeviceId !== this.cameraId) {
      this.closePeers();
      if (this.camera) this.deps.releaseCamera();
      releaseAll(this.camera);
      this.camera = null;
      this.cameraId = cameraDeviceId;
      if (cameraDeviceId) {
        const stream = await this.deps
          .acquireCamera(cameraDeviceId)
          .catch(() => null);
        if (generation !== this.generation || this.cameraId !== cameraDeviceId) {
          if (stream) this.deps.releaseCamera();
          releaseAll(stream);
          return;
        }
        this.camera = stream;
        if (stream)
          this.transport.toBubble({ target: "bubble", type: "rtc/available" });
      } else this.transport.toBubble({ target: "bubble", type: "rtc/ended" });
    }
    if (micDeviceId !== this.micId) {
      this.stopMeter?.();
      this.stopMeter = undefined;
      releaseAll(this.mic);
      this.mic = null;
      this.micId = micDeviceId;
      if (micDeviceId) {
        const stream = await this.deps.acquireMic(micDeviceId).catch(() => null);
        if (generation !== this.generation || this.micId !== micDeviceId) {
          releaseAll(stream);
          return;
        }
        this.mic = stream;
        const track = stream?.getAudioTracks()[0];
        if (track)
          this.stopMeter = this.deps.meter(track, (level) =>
            this.transport.toRecorder({
              target: "recorder",
              type: "preview/level",
              level,
            }),
          );
      }
    }
    // A grant may have just landed; labels appear only after one.
    await this.publishDevices();
  }

  /** A bubble frame asks for the camera. Offer only while the camera preview is on. */
  async hello(peer: string) {
    const track = this.camera?.getVideoTracks()[0];
    if (!track || !this.camera) return;
    this.peers.get(peer)?.close();
    const connection = this.deps.peer();
    this.peers.set(peer, connection);
    connection.onicecandidate = (event) => {
      if (event.candidate)
        this.transport.toBubble({
          target: "bubble",
          type: "rtc/ice",
          peer,
          candidate: event.candidate.toJSON(),
        });
    };
    connection.addTrack(track, this.camera);
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    if (this.peers.get(peer) !== connection) return;
    this.transport.toBubble({
      target: "bubble",
      type: "rtc/offer",
      peer,
      sdp: { type: "offer", sdp: connection.localDescription?.sdp ?? offer.sdp ?? "" },
    });
  }
  async answer(peer: string, sdp: RTCSessionDescriptionInit) {
    await this.peers.get(peer)?.setRemoteDescription(sdp);
  }
  async ice(peer: string, candidate: RTCIceCandidateInit) {
    await this.peers.get(peer)?.addIceCandidate(candidate).catch(() => undefined);
  }
  bye(peer: string) {
    this.peers.get(peer)?.close();
    this.peers.delete(peer);
  }

  private closePeers() {
    for (const connection of this.peers.values()) connection.close();
    this.peers.clear();
  }

  stop() {
    ++this.generation;
    this.closePeers();
    this.stopMeter?.();
    this.stopMeter = undefined;
    if (this.camera) this.deps.releaseCamera();
    releaseAll(this.camera, this.mic);
    this.camera = this.mic = null;
    this.cameraId = this.micId = null;
    this.transport.toBubble({ target: "bubble", type: "rtc/ended" });
  }
}

/** RMS level of a mic track, about ten times a second, scaled to 0..1. */
export function levelMeter(
  track: MediaStreamTrack,
  onLevel: (level: number) => void,
): () => void {
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  const source = context.createMediaStreamSource(new MediaStream([track]));
  source.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  const timer = setInterval(() => {
    analyser.getByteTimeDomainData(data);
    const rms = Math.sqrt(
      data.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / data.length,
    );
    onLevel(Math.min(1, Math.round(rms * 4 * 100) / 100));
  }, 100);
  return () => {
    clearInterval(timer);
    source.disconnect();
    void context.close().catch(() => undefined);
  };
}
