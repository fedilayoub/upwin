import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { browser } from "wxt/browser";
import { normalizeError } from "@/features/diagnostics/errors";
import {
  isVideoGone,
  recordingApi,
  RecordingApiError,
} from "./client";

const LIMITS = {
  available: true,
  storage: { usedBytes: 0 },
  maxDurationMs: 300_000,
  maxBytes: 100_000_000,
};

function answer(build: (requestId: string) => unknown) {
  return (message: unknown) =>
    Promise.resolve(build((message as { requestId: string }).requestId));
}

beforeEach(() => {
  fakeBrowser.reset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("recordingApi", () => {
  it("returns parsed data from the worker", async () => {
    vi.spyOn(browser.runtime, "sendMessage").mockImplementation(
      answer((requestId) => ({
        target: "sidepanel",
        type: "api/result",
        requestId,
        ok: true,
        data: LIMITS,
      })) as never,
    );
    await expect(recordingApi("getLimits")).resolves.toEqual(LIMITS);
  });

  it("carries the worker's ref, status and request id into the thrown error", async () => {
    vi.spyOn(browser.runtime, "sendMessage").mockImplementation(
      answer((requestId) => ({
        target: "sidepanel",
        type: "api/result",
        requestId,
        ok: false,
        error: {
          code: "NO_SESSION",
          message: "Video request failed.",
          ref: "E-7F3A2C",
          status: 401,
          apiRequestId: "0b4c3f1e-9f7a-4f5e-8f61-2b1d7c9e5a10",
        },
      })) as never,
    );

    const failure = await recordingApi("getLimits").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(RecordingApiError);
    // The panel shows the worker's ref instead of minting a second one.
    expect(normalizeError(failure)).toMatchObject({
      code: "NO_SESSION",
      ref: "E-7F3A2C",
      httpStatus: 401,
      requestId: "0b4c3f1e-9f7a-4f5e-8f61-2b1d7c9e5a10",
      operation: "videos.getLimits",
    });
  });

  it("retries once when no worker answered, then succeeds", async () => {
    const send = vi
      .spyOn(browser.runtime, "sendMessage")
      .mockRejectedValueOnce(
        new Error("Could not establish connection. Receiving end does not exist."),
      )
      .mockImplementation(
        answer((requestId) => ({
          target: "sidepanel",
          type: "api/result",
          requestId,
          ok: true,
          data: LIMITS,
        })) as never,
      );

    await expect(recordingApi("getLimits")).resolves.toEqual(LIMITS);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("names a worker that never answers", async () => {
    vi.spyOn(browser.runtime, "sendMessage").mockResolvedValue(undefined as never);
    await expect(recordingApi("getLimits")).rejects.toMatchObject({
      code: "WORKER_NO_REPLY",
      operation: "videos.getLimits",
    });

    vi.spyOn(browser.runtime, "sendMessage").mockRejectedValue(
      new Error("The message port closed before a response was received."),
    );
    await expect(recordingApi("getLimits")).rejects.toMatchObject({
      code: "WORKER_UNAVAILABLE",
    });
  });

  it("times out a worker that hangs", async () => {
    vi.spyOn(browser.runtime, "sendMessage").mockReturnValue(
      new Promise(() => undefined) as never,
    );
    await expect(
      recordingApi("getLimits", {}, { timeoutMs: 5 }),
    ).rejects.toMatchObject({ code: "WORKER_NO_REPLY" });
  });
});

describe("isVideoGone", () => {
  it("treats the backend's not-found answer as a deleted video", () => {
    expect(
      isVideoGone(new RecordingApiError("VIDEO_NOT_FOUND", "videos.get")),
    ).toBe(true);
    expect(
      isVideoGone(
        new RecordingApiError("UNKNOWN", "videos.get", "ref", 404),
      ),
    ).toBe(true);
  });

  it("keeps real failures as failures", () => {
    expect(
      isVideoGone(new RecordingApiError("NETWORK_ERROR", "videos.get")),
    ).toBe(false);
    expect(
      isVideoGone(new RecordingApiError("UNKNOWN", "videos.get", "ref", 500)),
    ).toBe(false);
    expect(isVideoGone(new Error("VIDEO_NOT_FOUND"))).toBe(false);
  });
});
