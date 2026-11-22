import { describe, expect, it, vi } from "vitest";
import {
  buildDiagnosticsReport,
  runDiagnostics,
  type DiagnosticsCheck,
} from "./checks";

describe("runDiagnostics", () => {
  it("times the API and reports that a token is set, never its value", async () => {
    let clock = 1_000;
    const check = await runDiagnostics({
      getToken: async () => "local-api-token",
      fetchImpl: vi.fn<typeof fetch>().mockImplementation(async () => {
        clock += 42;
        return new Response('{"status":"ok"}', {
          headers: { "x-request-id": "0b4c3f1e-9f7a-4f5e-8f61-2b1d7c9e5a10" },
        });
      }),
      now: () => clock,
    });

    expect(check).toMatchObject({
      api: {
        status: "ok",
        httpStatus: 200,
        latencyMs: 42,
        requestId: "0b4c3f1e-9f7a-4f5e-8f61-2b1d7c9e5a10",
      },
      apiToken: "set",
    });
    expect(JSON.stringify(check)).not.toContain("local-api-token");
  });

  it("reports each failing check on its own, without throwing", async () => {
    const check = await runDiagnostics({
      getToken: () => Promise.reject(new Error("storage unavailable")),
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockRejectedValue(new TypeError("Failed to fetch")),
    });

    expect(check).toMatchObject({
      api: { status: "unreachable" },
      apiToken: "error",
    });
  });

  it("treats no token as normal for a loopback-only API", async () => {
    const check = await runDiagnostics({
      getToken: async () => null,
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("", { status: 503 })),
    });
    expect(check).toMatchObject({
      api: { status: "error", httpStatus: 503 },
      apiToken: "unset",
    });
  });
});

const CHECK: DiagnosticsCheck = {
  checkedAt: "2026-11-12T10:00:00.000Z",
  api: { status: "ok", httpStatus: 200, latencyMs: 80 },
  apiToken: "set",
};

describe("buildDiagnosticsReport", () => {
  it("lists versions, the token state and recent refs, and nothing personal", () => {
    const report = buildDiagnosticsReport({
      client: {
        version: "1.0.6",
        browser: "chrome",
        extensionId: "legkgjhnpcaiapmphifkbpkooodehifo",
      },
      apiUrl: "http://localhost:3002",
      check: CHECK,
      errors: [
        {
          id: "1",
          ref: "E-7F3A2C",
          occurredAt: "2026-11-12T09:59:00.000Z",
          surface: "worker",
          code: "NETWORK_ERROR",
          operation: "jobs.analyze",
          httpStatus: 401,
        },
      ],
    });

    expect(report).toContain("version: 1.0.6");
    expect(report).toContain("service: http://localhost:3002");
    expect(report).toContain("api token configured: yes");
    expect(report).toContain(
      "E-7F3A2C 2026-11-12T09:59:00.000Z worker NETWORK_ERROR op=jobs.analyze status=401",
    );
    expect(report).not.toMatch(/@|Bearer|token:/);
  });

  it("says when no check was run", () => {
    expect(
      buildDiagnosticsReport({
        client: { version: "1.0.6", browser: "edge" },
        apiUrl: "http://localhost:3002",
        check: null,
        errors: [],
      }),
    ).toContain("checks: not run");
  });
});
