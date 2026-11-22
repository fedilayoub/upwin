import type { Size } from "./layout";
export const mimeCandidates = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4;codecs=avc1.4d0028,mp4a.40.2",
  "video/mp4;codecs=avc1.42e01f,mp4a.40.2",
  "video/mp4;codecs=avc1.640028,opus",
  "video/mp4;codecs=avc1.640028",
] as const;
export function pickMime(
  supported: (mime: string) => boolean,
  hasAudio = true,
): string | null {
  return (
    mimeCandidates.find((mime, i) => (i < 4 || !hasAudio) && supported(mime)) ??
    null
  );
}
export const bitrateFor = (out: Size) =>
  out.w * out.h > 1280 * 720 ? 2_500_000 : 1_500_000;
export const audioBitrate = 128_000;
