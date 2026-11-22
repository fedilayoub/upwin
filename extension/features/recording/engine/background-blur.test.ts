import { expect, it } from "vitest";
import { personConfidence, smoothMask } from "./background-blur";

it("reads the person from the multiclass background mask, and the selfie mask as is", () => {
  const background = Float32Array.from([1, 0.25, 0]);
  const hair = Float32Array.from([0, 0.5, 0.2]);
  expect(Array.from(personConfidence([background, hair], "multiclass"))).toEqual([0, 0.75, 1]);
  expect(Array.from(personConfidence([background], "selfie"))).toEqual([1, 0.25, 0]);
  expect(personConfidence([], "multiclass")).toHaveLength(0);
});
it("smooths masks over time, clamps them and writes texture bytes", () => {
  const bytes = new Uint8Array(3);
  const first = smoothMask(Float32Array.from([0, 1, 2]), null, bytes);
  expect(Array.from(first)).toEqual([0, 1, 1]);
  expect(Array.from(bytes)).toEqual([0, 255, 255]);
  const second = smoothMask(Float32Array.from([1, 0, 1]), first, bytes, 0.5);
  expect(Array.from(second)).toEqual([0.5, 0.5, 1]);
  expect(Array.from(bytes)).toEqual([128, 128, 255]);
  // A mask of another size starts over instead of blending stale data.
  expect(Array.from(smoothMask(Float32Array.from([0.5]), second, new Uint8Array(1)))).toEqual([0.5]);
});
