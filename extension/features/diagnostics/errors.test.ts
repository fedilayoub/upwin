import { describe, expect, it } from "vitest";
import { ApiClientError } from "@/services/api";
import { detectBrowser } from "./client-info";
import {
  createErrorRef,
  formatErrorDetails,
  isErrorRef,
  normalizeError,
  sanitizeMeta,
  toErrorCode,
  type ErrorRecord,
} from "./errors";

describe("error refs", () => {
  it("are short, uppercase and match the API's pattern", () => {
    for (let index = 0; index < 50; index += 1) {
      const ref = createErrorRef();
      expect(ref).toMatch(/^E-[0-9A-Z]{6}$/);
      expect(isErrorRef(ref)).toBe(true);
    }
    expect(isErrorRef("E-abc123")).toBe(false);
  });
});

describe("toErrorCode", () => {
  it.each([
    ["NO_SESSION", "NO_SESSION"],
    ["NotAllowedError", "NOT_ALLOWED_ERROR"],
    ["video-not-found", "VIDEO_NOT_FOUND"],
    ["", null],
    ["_", null],
    [42, null],
  ])("%s → %s", (input, expected) => {
    expect(toErrorCode(input)).toBe(expected);
  });
});

describe("normalizeError", () => {
  it("keeps an API error's code, status and request id", () => {
    expect(
      normalizeError(
        new ApiClientError(
          "Gone",
          "videos.get",
          404,
          "VIDEO_NOT_FOUND",
          "0b4c3f1e-9f7a-4f5e-8f61-2b1d7c9e5a10",
        ),
      ),
    ).toEqual({
      code: "VIDEO_NOT_FOUND",
      httpStatus: 404,
      requestId: "0b4c3f1e-9f7a-4f5e-8f61-2b1d7c9e5a10",
      errorName: "ApiClientError",
      operation: "videos.get",
    });
  });

  it("falls back to HTTP_<status> when the API sent no code", () => {
    expect(
      normalizeError(new ApiClientError("x", "op", 502)).code,
    ).toBe("HTTP_502");
  });

  it("recognises network failures, timeouts and bad payloads", () => {
    expect(normalizeError(new TypeError("Failed to fetch")).code).toBe(
      "NETWORK_ERROR",
    );
    expect(
      normalizeError(new DOMException("t", "TimeoutError")).code,
    ).toBe("TIMEOUT");
    const zod = Object.assign(new Error("bad"), { name: "ZodError" });
    expect(normalizeError(zod).code).toBe("INVALID_RESPONSE");
  });

  it("uses a coded error's own code", () => {
    class CaptureError extends Error {
      constructor(readonly code: string) {
        super("capture failed");
      }
    }
    expect(normalizeError(new CaptureError("UNSUPPORTED_PAGE")).code).toBe(
      "UNSUPPORTED_PAGE",
    );
  });

  it("keeps a ref another context already reported under", () => {
    expect(normalizeError({ code: "NO_SESSION", ref: "E-7F3A2C" })).toMatchObject(
      { code: "NO_SESSION", ref: "E-7F3A2C" },
    );
  });

  it("never turns a message into a code", () => {
    expect(
      normalizeError(new Error("Session expired for john@example.com")).code,
    ).toBe("UNEXPECTED");
    expect(normalizeError(new TypeError("x is undefined")).code).toBe(
      "TYPE_ERROR",
    );
    expect(normalizeError(undefined).code).toBe("UNEXPECTED");
  });

  it("drops a malformed request id or operation", () => {
    const normalized = normalizeError({
      code: "X_Y",
      requestId: "not valid\n",
      operation: "https://evil.example/?token=1",
    });
    expect(normalized).toEqual({ code: "X_Y" });
  });
});

describe("sanitizeMeta", () => {
  it("keeps short scalar values under valid keys only", () => {
    expect(
      sanitizeMeta({
        phase: "idle",
        count: 3,
        ok: false,
        "bad key": "x",
        long: "y".repeat(200),
        inf: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({ phase: "idle", count: 3, ok: false, long: "y".repeat(80), inf: null });
  });
});

describe("formatErrorDetails", () => {
  it("is plain text without any page data", () => {
    const record: ErrorRecord = {
      id: "1",
      ref: "E-7F3A2C",
      occurredAt: "2026-11-12T10:00:00.000Z",
      surface: "sidepanel",
      code: "NO_SESSION",
      operation: "videos.getLimits",
      httpStatus: 401,
    };
    expect(formatErrorDetails(record, { version: "1.0.6", browser: "chrome" }))
      .toBe(`upwin error E-7F3A2C
code: NO_SESSION
operation: videos.getLimits
http status: 401
where: sidepanel
when: 2026-11-12T10:00:00.000Z
version: 1.0.6 (chrome)`);
  });
});

describe("detectBrowser", () => {
  it.each([
    ["Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/156.0.0.0 Safari/537.36", "chrome"],
    ["Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0", "edge"],
    ["Mozilla/5.0 (Macintosh; rv:140.0) Gecko/20100101 Firefox/140.0", "firefox"],
    ["curl/8", "other"],
  ])("%s → %s", (userAgent, expected) => {
    expect(detectBrowser(userAgent)).toBe(expected);
  });
});
