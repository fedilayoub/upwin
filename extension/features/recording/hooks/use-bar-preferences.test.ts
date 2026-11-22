import { expect, it } from "vitest";
import {
  barPreferencesSchema,
  defaultBarPreferences,
} from "./use-bar-preferences";

it("selects Window by default, which needs no permission beyond camera and mic", () => {
  expect(defaultBarPreferences.mode).toBe("window");
  // A stored value that no longer parses falls back to the same default.
  expect(
    barPreferencesSchema.parse({ ...defaultBarPreferences, mode: "bogus" })
      .mode,
  ).toBe("window");
});

it("keeps a mode the user picked before", () => {
  expect(
    barPreferencesSchema.parse({ ...defaultBarPreferences, mode: "tab" }).mode,
  ).toBe("tab");
});
