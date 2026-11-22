import { expect, it } from "vitest";
import { initialState, phaseSchema } from "../protocol";
import { reduce, type SessionEvent } from "./session-machine";
it("runs the complete lifecycle and excludes paused ticks", () => {
  let s = initialState;
  for (const type of [
    "start",
    "acquired",
    "picked",
    "created",
    "countdown-done",
  ] as const)
    s = reduce(s, { type, now: 1000 });
  s = reduce(s, { type: "tick", now: 1000 });
  s = reduce(s, { type: "pause" });
  s = reduce(s, { type: "tick", now: 10000 });
  expect(s.elapsedMs).toBe(1000);
  for (const type of ["resume", "stop", "parts-drained", "completed"] as const)
    s = reduce(s, { type });
  expect(s.phase).toBe("done");
});
it("cancels picker and area before create, and stops on display end and limit", () => {
  expect(
    reduce({ ...initialState, phase: "picking" }, { type: "pick-cancelled" })
      .phase,
  ).toBe("idle");
  expect(
    reduce(
      { ...initialState, phase: "selecting-area" },
      { type: "area-cancelled" },
    ).phase,
  ).toBe("idle");
  for (const type of ["display-ended", "limit-reached"] as const)
    expect(
      reduce({ ...initialState, phase: "recording" }, { type }).phase,
    ).toBe("stopping");
  expect(
    reduce({ ...initialState, phase: "creating" }, { type: "cancel" }).phase,
  ).toBe("idle");
});
it("covers legal and ignored transitions across every phase", () => {
  const legal: Partial<Record<SessionEvent["type"], string[]>> = {
    start: ["idle", "done", "failed"],
    acquired: ["acquiring"],
    picked: ["picking"],
    "area-selected": ["selecting-area"],
    created: ["creating"],
    "countdown-done": ["countdown"],
    pause: ["recording"],
    resume: ["paused"],
    "parts-drained": ["uploading", "stopping"],
    completed: ["completing"],
    recover: ["idle", "failed"],
  };
  for (const [type, phases] of Object.entries(legal))
    for (const phase of phaseSchema.options) {
      const s = { ...initialState, phase };
      const next = reduce(s, { type: type as SessionEvent["type"] });
      if (!phases.includes(phase)) expect(next).toBe(s);
      else expect(next).not.toBe(s);
    }
});
