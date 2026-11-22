import { useEffect, useRef } from "react";
import { browser } from "wxt/browser";
import { bubbleSchema } from "../protocol";

/**
 * The live camera bubble. It holds no camera of its own: the offscreen document captures the
 * camera under the extension's grant and streams it here over a local RTCPeerConnection.
 * Nothing leaves the machine.
 */
export function CameraBubble({ className = "" }: { className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const peer = crypto.randomUUID();
    let connection: RTCPeerConnection | null = null;
    const send = (message: Record<string, unknown>) =>
      void browser.runtime
        .sendMessage({ target: "offscreen", peer, ...message })
        .catch(() => undefined);
    const reset = () => {
      connection?.close();
      connection = null;
      if (video.current) video.current.srcObject = null;
    };
    const hello = () => {
      reset();
      const next = new RTCPeerConnection();
      connection = next;
      next.ontrack = (event) => {
        if (video.current && connection === next)
          video.current.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      };
      next.onicecandidate = (event) => {
        if (event.candidate)
          send({ type: "rtc/ice", candidate: event.candidate.toJSON() });
      };
      send({ type: "rtc/hello" });
    };
    const listener = (raw: unknown, sender: Browser.runtime.MessageSender) => {
      if (sender.id !== browser.runtime.id) return;
      const parsed = bubbleSchema.safeParse(raw);
      if (!parsed.success) return;
      const message = parsed.data;
      switch (message.type) {
        case "rtc/available":
          hello();
          return;
        case "rtc/ended":
          reset();
          return;
        case "rtc/offer": {
          const current = connection;
          if (message.peer !== peer || !current) return;
          void (async () => {
            await current.setRemoteDescription(message.sdp);
            const answer = await current.createAnswer();
            await current.setLocalDescription(answer);
            send({
              type: "rtc/answer",
              sdp: { type: "answer", sdp: current.localDescription?.sdp ?? answer.sdp ?? "" },
            });
          })().catch(() => undefined);
          return;
        }
        case "rtc/ice":
          if (message.peer === peer)
            void connection?.addIceCandidate(message.candidate).catch(() => undefined);
          return;
      }
    };
    browser.runtime.onMessage.addListener(listener);
    hello();
    const bye = () => send({ type: "rtc/bye" });
    window.addEventListener("pagehide", bye);
    return () => {
      bye();
      reset();
      browser.runtime.onMessage.removeListener(listener);
      window.removeEventListener("pagehide", bye);
    };
  }, []);
  return (
    <video
      ref={video}
      autoPlay
      muted
      playsInline
      aria-hidden
      className={className}
      style={{ transform: "scaleX(-1)", objectFit: "cover", background: "#111" }}
    />
  );
}
