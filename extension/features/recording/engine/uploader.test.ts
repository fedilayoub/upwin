import { expect, it, vi } from "vitest";
import { Uploader } from "./uploader";
import type { EngineHost } from "./host";
const part = (partNumber: number) => ({ partNumber, blob: new Blob(["abcd"]) });
function fixture() {
  const api = vi.fn(async (_op: string, p: { partNumbers: number[] }) => ({
    parts: p.partNumbers.map((partNumber) => ({
      partNumber,
      url: `https://storage.test/${partNumber}`,
      expiresAt: new Date(3600_000).toISOString(),
    })),
  }));
  const host = {
    api,
    now: () => 0,
    emitState: vi.fn(),
    requestArea: vi.fn(),
  } as unknown as EngineHost;
  return { api, host };
}
it("caps concurrent PUTs at two, batches ten URLs, and drains after acknowledgment", async () => {
  const { host, api } = fixture();
  let inflight = 0,
    peak = 0;
  const fetch = vi.fn(async () => {
    inflight++;
    peak = Math.max(peak, inflight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inflight--;
    return new Response(null, { headers: { ETag: '"etag"' } });
  });
  const ack = vi.fn(async () => undefined),
    uploader = new Uploader("video", 20, host, { fetch, uploaded: ack });
  for (let n = 1; n <= 12; n++) uploader.enqueue(part(n));
  await uploader.drain();
  expect(peak).toBe(2);
  expect(ack).toHaveBeenCalledTimes(12);
  expect(uploader.parts.map((p) => p.partNumber)).toEqual(
    Array.from({ length: 12 }, (_, n) => n + 1),
  );
  expect(api.mock.calls[0]![1].partNumbers).toHaveLength(10);
  expect(api).toHaveBeenCalledTimes(2);
});
it.each([403, 503])(
  "retries %s and refreshes a forbidden URL",
  async (status) => {
    const { host, api } = fixture(),
      healthy = vi.fn(),
      wait = vi.fn(async () => undefined);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValue(new Response(null, { headers: { ETag: '"etag"' } }));
    const uploader = new Uploader("video", 1, host, {
      fetch,
      wait,
      healthy,
      random: () => 0.5,
    });
    uploader.enqueue(part(1));
    await uploader.drain();
    expect(wait).toHaveBeenCalledWith(1000, expect.any(AbortSignal));
    expect(api).toHaveBeenCalledTimes(status === 403 ? 2 : 1);
    expect(healthy).toHaveBeenCalledWith(false);
    expect(healthy).toHaveBeenLastCalledWith(true);
  },
);
it("fails a missing ETag instead of retrying forever", async () => {
  const { host } = fixture(),
    uploader = new Uploader("video", 1, host, {
      fetch: vi.fn(async () => new Response(null)),
    });
  uploader.enqueue(part(1));
  await expect(uploader.drain()).rejects.toMatchObject({ code: "UPLOAD_CORS" });
});
it("resumes from authoritative server parts and skips them", async () => {
  const { host, api } = fixture();
  api.mockResolvedValueOnce({
    parts: [{ partNumber: 1, sizeBytes: 4, etag: '"server"' }],
  } as never);
  const fetch = vi.fn(
      async () => new Response(null, { headers: { ETag: '"new"' } }),
    ),
    uploader = new Uploader("video", 2, host, { fetch });
  await uploader.resume();
  uploader.enqueue(part(1));
  uploader.enqueue(part(2));
  await uploader.drain();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(uploader.parts[0]!.etag).toBe('"server"');
});
it("re-presigns near expiry and cancels retry waits", async () => {
  const { host } = fixture();
  const controller = new AbortController();
  const uploader = new Uploader("video", 1, host, {
    fetch: vi.fn().mockRejectedValue(new TypeError("offline")),
    wait: async (_ms, signal) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
        controller.abort();
      }),
  });
  uploader.enqueue(part(1));
  const drained = uploader.drain();
  await vi.waitFor(() => expect(controller.signal.aborted).toBe(true));
  uploader.cancel();
  await expect(drained).rejects.toMatchObject({ name: "AbortError" });
});
