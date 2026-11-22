import { expect, it } from "vitest";
import { PartAssembler } from "./part-assembler";
it("cuts by bytes across arbitrary chunk boundaries", async () => {
  const size = 8 * 1024 * 1024,
    assembler = new PartAssembler(size);
  const input = [
    new Blob(["a"]),
    new Blob([new Uint8Array(300 * 1024).fill(7)]),
    new Blob([new Uint8Array(20 * 1024 * 1024).fill(9)]),
  ];
  const parts = input.flatMap((blob) => assembler.push(blob));
  const last = assembler.flush();
  if (last) parts.push(last);
  expect(parts.map((p) => p.partNumber)).toEqual([1, 2, 3]);
  expect(parts.slice(0, -1).every((p) => p.blob.size === size)).toBe(true);
  expect(assembler.bytesTotal).toBe(input.reduce((n, b) => n + b.size, 0));
  expect(await new Blob(parts.map((p) => p.blob)).arrayBuffer()).toEqual(
    await new Blob(input).arrayBuffer(),
  );
});
it("never emits an empty final part", () => {
  const assembler = new PartAssembler(4);
  expect(assembler.flush()).toBeNull();
  expect(
    assembler.push(new Blob(["12345678"])).map((p) => p.blob.size),
  ).toEqual([4, 4]);
  expect(assembler.flush()).toBeNull();
});
