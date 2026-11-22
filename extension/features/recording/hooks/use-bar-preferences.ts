import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { z } from "zod";
import { settingsSchema } from "../protocol";

export const barPreferencesSchema = z.object({
  mode: settingsSchema.shape.mode.catch("window"),
  cameraOn: z.boolean().catch(true),
  micOn: z.boolean().catch(true),
  cameraDeviceId: z.string().max(512).nullable().catch(null),
  micDeviceId: z.string().max(512).nullable().catch(null),
  includeDisplayAudio: z.boolean().catch(false),
  countdown: z.boolean().catch(true),
  blur: z.boolean().catch(false),
});
export type BarPreferences = z.infer<typeof barPreferencesSchema>;
export const defaultBarPreferences: BarPreferences = {
  // Window by default: the browser's picker needs no extra permission, so a first recording
  // asks for nothing beyond the camera and microphone.
  mode: "window",
  cameraOn: true,
  micOn: true,
  cameraDeviceId: null,
  micDeviceId: null,
  includeDisplayAudio: false,
  countdown: true,
  blur: false,
};
const KEY = "recording.bar";

/** The recorder bar's remembered choices, in `storage.local`. */
export function useBarPreferences() {
  const [preferences, setPreferences] = useState(defaultBarPreferences);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    void browser.storage.local
      .get(KEY)
      .then((value) => {
        const stored: unknown = value[KEY];
        const parsed = barPreferencesSchema.safeParse({
          ...defaultBarPreferences,
          ...(typeof stored === "object" && stored !== null ? stored : {}),
        });
        if (alive && parsed.success) setPreferences(parsed.data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoaded(true);
      });
    // The camera settings panel on the page toggles the blur in this same key.
    const onChanged = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ) => {
      const change = changes[KEY];
      if (areaName !== "local" || !change) return;
      const parsed = barPreferencesSchema.safeParse({
        ...defaultBarPreferences,
        ...(typeof change.newValue === "object" && change.newValue !== null
          ? change.newValue
          : {}),
      });
      if (alive && parsed.success) setPreferences(parsed.data);
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);
  const update = (patch: Partial<BarPreferences>) =>
    setPreferences((current) => {
      const next = { ...current, ...patch };
      void browser.storage.local.set({ [KEY]: next }).catch(() => undefined);
      return next;
    });
  return { preferences, update, loaded };
}
