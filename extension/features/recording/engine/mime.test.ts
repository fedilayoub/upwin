import { expect, it } from "vitest";
import { pickMime, mimeCandidates, bitrateFor } from "./mime";
it("prefers H.264/AAC in declared order", () => {
  expect(pickMime(() => true)).toBe(mimeCandidates[0]);
  expect(pickMime((m) => m !== mimeCandidates[0])).toBe(mimeCandidates[1]);
});
it("only accepts video-only MP4 without audio", () => {
  expect(pickMime((m) => m === mimeCandidates[4])).toBeNull();
  expect(pickMime((m) => m === mimeCandidates[4], false)).toBe(
    mimeCandidates[4],
  );
  expect(pickMime(() => false, false)).toBeNull();
});
it("uses the resolution-dependent bitrate", () => {
  expect(bitrateFor({ w: 1280, h: 720 })).toBe(1500000);
  expect(bitrateFor({ w: 1920, h: 1080 })).toBe(2500000);
});
