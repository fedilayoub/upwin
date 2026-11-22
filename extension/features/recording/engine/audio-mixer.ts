export interface AudioMix {
  track: MediaStreamTrack | null;
  mute(value: boolean): void;
  stop(): Promise<void>;
}
export function mixAudio(
  mic: MediaStreamTrack | null,
  display: MediaStreamTrack | null,
): AudioMix {
  if (!mic || !display)
    return {
      track: mic ?? display,
      mute(value) {
        if (mic) mic.enabled = !value;
      },
      stop: async () => undefined,
    };
  const context = new AudioContext(),
    destination = context.createMediaStreamDestination();
  const micSource = context.createMediaStreamSource(new MediaStream([mic])),
    displaySource = context.createMediaStreamSource(new MediaStream([display]));
  const micGain = context.createGain(),
    displayGain = context.createGain();
  micSource.connect(micGain).connect(destination);
  displaySource.connect(displayGain).connect(destination);
  if (context.state !== "running") void context.resume();
  return {
    track: destination.stream.getAudioTracks()[0] ?? null,
    mute(value) {
      micGain.gain.value = value ? 0 : 1;
    },
    async stop() {
      micSource.disconnect();
      displaySource.disconnect();
      micGain.disconnect();
      displayGain.disconnect();
      destination.stream.getTracks().forEach((t) => t.stop());
      await context.close();
    },
  };
}
