import { afterEach, describe, expect, it, vi } from "vitest";
import { limitsSchema, videosService } from "./videos";
import { ApiClientError } from "./api";
import { video, limits } from "@/features/recording/test-fixtures";
const token = async () => "test-token";
const methods = [
  {
    name: "getLimits",
    run: () => videosService.getLimits(token),
    response: limits,
    method: "GET",
    path: "/videos/limits",
  },
  {
    name: "create",
    run: () =>
      videosService.create(
        {
          sourceKind: "screen",
          hasCamera: false,
          hasAudio: true,
          mimeType: "video/mp4",
        },
        token,
      ),
    response: {
      video,
      upload: {
        partSizeBytes: 8388608,
        maxParts: 20,
        maxBytes: limits.maxBytes,
        maxDurationMs: 300000,
      },
    },
    method: "POST",
    path: "/videos",
  },
  {
    name: "presignParts",
    run: () =>
      videosService.presignParts(video.id, { partNumbers: [1] }, token),
    response: {
      parts: [
        {
          partNumber: 1,
          url: "https://storage.test/part",
          expiresAt: "2026-11-08T01:00:00Z",
        },
      ],
    },
    method: "POST",
    path: `/videos/${video.id}/upload-parts`,
  },
  {
    name: "listUploadedParts",
    run: () => videosService.listUploadedParts(video.id, token),
    response: {
      parts: [{ partNumber: 1, etag: '"etag"', sizeBytes: 8388608 }],
    },
    method: "GET",
    path: `/videos/${video.id}/upload-parts`,
  },
  {
    name: "complete",
    run: () =>
      videosService.complete(
        video.id,
        { parts: [{ partNumber: 1, etag: '"etag"' }], clientDurationMs: 1000 },
        token,
      ),
    response: { video: { ...video, status: "processing" } },
    method: "POST",
    path: `/videos/${video.id}/complete`,
  },
  {
    name: "abortUpload",
    run: () => videosService.abortUpload(video.id, token),
    response: undefined,
    method: "DELETE",
    path: `/videos/${video.id}/upload`,
  },
  {
    name: "list",
    run: () =>
      videosService.list(
        { limit: 10, jobSnapshotId: video.id, cursor: "next & page" },
        token,
      ),
    response: { items: [video], nextCursor: null },
    method: "GET",
    path: `/videos?cursor=next+%26+page&limit=10&jobSnapshotId=${video.id}`,
  },
  {
    name: "get",
    run: () => videosService.get(video.id, token),
    response: { video },
    method: "GET",
    path: `/videos/${video.id}`,
  },
  {
    name: "rename",
    run: () => videosService.rename(video.id, { title: "New title" }, token),
    response: { video: { ...video, title: "New title" } },
    method: "PATCH",
    path: `/videos/${video.id}`,
  },
  {
    name: "remove",
    run: () => videosService.remove(video.id, token),
    response: undefined,
    method: "DELETE",
    path: `/videos/${video.id}`,
  },
];
afterEach(() => vi.unstubAllGlobals());
describe("video endpoints", () => {
  it.each(methods)(
    "$name validates its response and transport",
    async (entry) => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(
          new Response(
            entry.response === undefined
              ? null
              : JSON.stringify(entry.response),
            { status: entry.response === undefined ? 204 : 200 },
          ),
        );
      vi.stubGlobal("fetch", fetch);
      await expect(entry.run()).resolves.toEqual(entry.response);
      const [url, options] = fetch.mock.calls[0]!;
      expect(new URL(String(url)).pathname + new URL(String(url)).search).toBe(
        entry.path,
      );
      expect(options?.method).toBe(entry.method);
      expect(options?.credentials).toBe("omit");
    },
  );
  it.each([
    "VIDEO_NOT_CONFIGURED",
    "VIDEO_NOT_FOUND",
    "VIDEO_NOT_UPLOADING",
    "VIDEO_UPLOAD_INVALID",
    "VIDEO_TOO_LARGE",
    "VIDEO_STORAGE_ERROR",
    "VALIDATION_FAILED",
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "NOT_FOUND",
  ])("preserves %s as ApiClientError.code", async (code) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          async () =>
            new Response(
              JSON.stringify({ error: { code, message: "Request failed" } }),
              { status: 422 },
            ),
        ),
    );
    await expect(videosService.getLimits(token)).rejects.toMatchObject({
      code,
    });
    await expect(videosService.getLimits(token)).rejects.toBeInstanceOf(
      ApiClientError,
    );
  });
  it("rejects mismatched responses and strips additive fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ ...limits, maxDurationMs: "five minutes" }),
        )
        .mockResolvedValueOnce(Response.json({ ...limits, future: true })),
    );
    await expect(videosService.getLimits(token)).rejects.toThrow();
    await expect(videosService.getLimits(token)).resolves.toEqual(limits);
  });
});
it("rejects a negative storage figure", () => {
  expect(
    limitsSchema.safeParse({ ...limits, storage: { usedBytes: -1 } }).success,
  ).toBe(false);
});
