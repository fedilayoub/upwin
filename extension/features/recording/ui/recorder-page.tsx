import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { useI18n } from "@/features/i18n/i18n-context";
import {
  cornerSchema,
  roundnessSchema,
  sizeSchema,
  zoomSchema,
} from "../protocol";
import { SHAPES, ZOOM_RANGE, clampZoom, formatZoom, nearestShape } from "../host-layout";
import { RecorderBar } from "./recorder-bar";
import { CameraBubble } from "./camera-bubble";
import { useRecordingState } from "../hooks/use-recording-state";

/** From the pick to the end of the take: what this tab shows may be inside the capture. */
const CAPTURING = ["creating", "countdown", "recording", "paused"];

/**
 * The fallback recorder tab, for pages that refuse scripts (browser pages, the store, PDFs).
 * Same bar and live camera; Window and Display only, since there is no page tab to record.
 */
export function RecorderPage() {
  const { t } = useI18n();
  const [roundness, setRoundness] = useState(1);
  const [zoom, setZoom] = useState(1);
  // This tab has no page host, so nothing can tell whether it is inside the recorded window or
  // screen. The compositor draws the camera, and the view here leaves for the take: left on
  // the page, it could be recorded as a second camera.
  const capturing = CAPTURING.includes(useRecordingState("recorder").phase);
  useEffect(() => {
    const close = () =>
      void browser.runtime
        .sendMessage({ target: "background", type: "recorder/close" })
        .catch(() => undefined);
    window.addEventListener("pagehide", close);
    void browser.storage.local
      .get("recording.bubble")
      .then((value) => {
        const saved = value["recording.bubble"] as
          { roundness?: unknown; zoom?: unknown } | undefined;
        const parsed = roundnessSchema.safeParse(saved?.roundness);
        if (parsed.success) setRoundness(parsed.data);
        const savedZoom = zoomSchema.safeParse(saved?.zoom);
        if (savedZoom.success) setZoom(savedZoom.data);
      })
      .catch(() => undefined);
    return () => window.removeEventListener("pagehide", close);
  }, []);
  // The worker reads this at Start: the composited camera gets the same shape and zoom.
  const save = (patch: { roundness?: number; zoom?: number }) =>
    void browser.storage.local
      .get("recording.bubble")
      .then((stored) => {
        const saved = stored["recording.bubble"] as
          | {
              corner?: unknown;
              size?: unknown;
              roundness?: unknown;
              zoom?: unknown;
            }
          | undefined;
        const corner = cornerSchema.safeParse(saved?.corner);
        const size = sizeSchema.safeParse(saved?.size);
        const savedRoundness = roundnessSchema.safeParse(saved?.roundness);
        const savedZoom = zoomSchema.safeParse(saved?.zoom);
        return browser.storage.local.set({
          "recording.bubble": {
            corner: corner.success ? corner.data : "bottom-right",
            size: size.success ? size.data : "md",
            roundness:
              patch.roundness ??
              (savedRoundness.success ? savedRoundness.data : 1),
            zoom: patch.zoom ?? (savedZoom.success ? savedZoom.data : 1),
          },
        });
      })
      .catch(() => undefined);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 text-foreground">
      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-lg font-semibold">{t("video.fallbackTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("video.fallbackBody")}</p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div
          className={`size-40 overflow-hidden shadow-2xl transition-[border-radius] duration-150 ${capturing ? "invisible" : ""}`}
          style={{ borderRadius: `${Math.round(roundness * 50)}%` }}
        >
          <div
            className="size-full transition-transform duration-100"
            style={{ transform: `scale(${zoom})` }}
          >
            {!capturing && <CameraBubble className="size-full" />}
          </div>
        </div>
        <div className="w-64 space-y-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
          <div
            role="group"
            aria-label={t("video.shape")}
            className="grid grid-cols-4 gap-1.5"
          >
            {SHAPES.map((shape) => {
              const selected = nearestShape(roundness) === shape.id;
              return (
                <button
                  key={shape.id}
                  type="button"
                  aria-pressed={selected}
                  aria-label={t(`video.shape.${shape.id}`)}
                  title={t(`video.shape.${shape.id}`)}
                  onClick={() => {
                    setRoundness(shape.roundness);
                    save({ roundness: shape.roundness });
                  }}
                  className={`grid h-11 place-items-center rounded-xl transition-colors ${
                    selected
                      ? "bg-primary/15 ring-[1.5px] ring-primary ring-inset"
                      : "bg-foreground/5 hover:bg-foreground/10"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`size-5 ${selected ? "bg-primary" : "bg-muted-foreground"}`}
                    style={{
                      borderRadius: `${Math.round(shape.roundness * 50)}%`,
                    }}
                  />
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="w-10">{t("video.zoom")}</span>
            <input
              type="range"
              min={ZOOM_RANGE.min * 100}
              max={ZOOM_RANGE.max * 100}
              step={5}
              value={Math.round(zoom * 100)}
              aria-label={t("video.zoom")}
              className="flex-1 cursor-pointer accent-primary"
              onChange={(event) =>
                setZoom(clampZoom(Number(event.target.value) / 100))
              }
              onPointerUp={() => save({ zoom })}
              onKeyUp={() => save({ zoom })}
            />
            <span className="w-9 text-right font-semibold text-foreground tabular-nums">
              {formatZoom(zoom)}
            </span>
          </label>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-border">
        <RecorderBar embedded={false} fallback />
      </div>
    </main>
  );
}
