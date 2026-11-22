import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { ApiClientError } from "@/services/api";
import {
  errorLogItem,
  LOG_LIMIT,
  reportError,
  whenPersisted,
} from "./error-log";

beforeEach(() => {
  fakeBrowser.reset();
});

describe("reportError", () => {
  it("returns a record at once and persists it to the local log", async () => {
    const record = reportError({
      error: new ApiClientError("x", "videos.getLimits", 401, "NO_SESSION"),
      surface: "sidepanel",
      meta: { phase: "idle" },
    });

    expect(record).toMatchObject({
      ref: expect.stringMatching(/^E-[0-9A-Z]{6}$/),
      surface: "sidepanel",
      code: "NO_SESSION",
      operation: "videos.getLimits",
      httpStatus: 401,
      meta: { phase: "idle" },
    });
    await whenPersisted();
    expect(await errorLogItem.getValue()).toEqual([record]);
  });

  it("keeps only the latest entries in the log", async () => {
    for (let index = 0; index < LOG_LIMIT + 5; index += 1)
      reportError({ error: { code: `CODE_${index}` }, surface: "worker" });
    await whenPersisted();
    const log = await errorLogItem.getValue();
    expect(log).toHaveLength(LOG_LIMIT);
    expect(log[0]?.code).toBe(`CODE_${LOG_LIMIT + 4}`);
  });

  it("reuses a ref another context reported, without storing it again", async () => {
    const record = reportError({
      error: { code: "NO_SESSION", ref: "E-ABC123", status: 401 },
      surface: "sidepanel",
    });
    expect(record.ref).toBe("E-ABC123");
    await whenPersisted();
    expect(await errorLogItem.getValue()).toHaveLength(0);
  });

  it("lets the caller set the code and keeps the error's name", () => {
    const record = reportError({
      error: new TypeError("x is undefined"),
      code: "RENDER_CRASH",
    });
    expect(record).toMatchObject({ code: "RENDER_CRASH", errorName: "TypeError" });
  });
});
