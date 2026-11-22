import { describe, expect, it, vi } from "vitest";
import { copyInFrame } from "./clipboard";

function fakeDocument(exec: boolean | "throw") {
  const calls: string[] = [];
  const area = {
    value: "",
    style: { cssText: "" },
    setAttribute: vi.fn(),
    select: vi.fn(() => calls.push("select")),
    remove: vi.fn(() => calls.push("remove")),
  };
  const focus = vi.fn(() => calls.push("focus"));
  const doc = {
    createElement: vi.fn(() => area),
    activeElement: { focus },
    body: { append: vi.fn(() => calls.push("append")) },
    execCommand: vi.fn(() => {
      calls.push("exec");
      if (exec === "throw") throw new Error("blocked");
      return exec;
    }),
  };
  return { doc: doc as unknown as Document, area, calls };
}

describe("copyInFrame", () => {
  it("copies the text synchronously and cleans up", () => {
    const { doc, area, calls } = fakeDocument(true);

    expect(copyInFrame("https://upwin.example.com/v/abc", doc)).toBe(true);
    expect(area.value).toBe("https://upwin.example.com/v/abc");
    // Out of flow, so the bar's frame does not resize while copying.
    expect(area.style.cssText).toContain("position:fixed");
    expect(calls).toEqual(["append", "select", "exec", "remove", "focus"]);
    expect(doc.execCommand).toHaveBeenCalledWith("copy");
  });

  it("reports failure instead of throwing, so the next path can try", () => {
    expect(copyInFrame("x", fakeDocument(false).doc)).toBe(false);
    const blocked = fakeDocument("throw");
    expect(copyInFrame("x", blocked.doc)).toBe(false);
    expect(blocked.calls).toContain("remove");
  });
});
