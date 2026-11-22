import { formatBytes } from "./format-bytes";
import { useEffect, useState } from "react";
import { storage } from "#imports";
import {
  Briefcase,
  CircleCheck,
  MousePointerClick,
  Puzzle,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/i18n-context";
import type { TranslationKey } from "@/features/i18n/dictionaries/en";
import type { VideoLimits } from "@/types/video";
import { openRecorder } from "../client";
import {
  openShortcutSettings,
  useRecordingShortcut,
} from "../hooks/use-recording-shortcut";
import {
  PENDING_OPEN_KEY,
  PENDING_OPEN_TTL_MS,
  pendingOpenSchema,
  type RecorderIntent,
} from "../protocol";

export type VideoIntent = RecorderIntent;

/** Written by the worker when Record was refused for want of `activeTab`; cleared once spent. */
const pendingOpenItem = storage.defineItem<unknown>(
  `session:${PENDING_OPEN_KEY}`,
  { fallback: null },
);

function isFreshPendingOpen(value: unknown): boolean {
  const pending = pendingOpenSchema.safeParse(value);
  return (
    pending.success &&
    Date.now() - pending.data.requestedAt <= PENDING_OPEN_TTL_MS
  );
}

/** Opens the in-page recorder on the current tab. Setup happens on the page itself. */
export function NewRecording({
  limits,
  intent,
}: {
  limits: VideoLimits;
  intent?: VideoIntent | null;
}) {
  const { t, locale } = useI18n();
  const [hint, setHint] = useState<TranslationKey | null>(null);
  const [needsToolbar, setNeedsToolbar] = useState(false);
  const [busy, setBusy] = useState(false);
  const shortcut = useRecordingShortcut();

  // A Record that is waiting for the toolbar click (started here or from a proposal) keeps
  // its instructions on screen, and they give way to a confirmation once the click lands.
  useEffect(() => {
    let cancelled = false;
    void pendingOpenItem
      .getValue()
      .then((value) => {
        if (!cancelled && isFreshPendingOpen(value)) setNeedsToolbar(true);
      })
      .catch(() => undefined);
    const unwatch = pendingOpenItem.watch((value, previous) => {
      const waiting = isFreshPendingOpen(value);
      setNeedsToolbar(waiting);
      // The worker clears the record only once the recorder is up.
      if (!waiting && value === null && isFreshPendingOpen(previous))
        setHint("video.openedOnPage");
    });
    return () => {
      cancelled = true;
      unwatch();
    };
  }, []);
  const storageUsed = formatBytes(limits.storage.usedBytes, locale);
  const opened = hint === "video.openedOnPage" || hint === "video.openedInTab";
  return (
    <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs">
      <div className="bg-gradient-to-b from-primary/[0.06] to-transparent p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Video className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-sm font-semibold">{t("video.newTitle")}</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("video.newBody")}
            </p>
          </div>
        </div>
        {intent && (
          <p className="mt-3 flex max-w-full items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground">
            <Briefcase className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate" title={intent.title}>
              {/* Already "For: <job>": the proposal screen builds it. */}
              {intent.title}
            </span>
          </p>
        )}
        <Button
          className="mt-4 h-10 w-full gap-2.5"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setHint(null);
            void openRecorder(intent ?? null)
              .then((result) => {
                setNeedsToolbar(result === "needs-toolbar");
                setHint(
                  result === "page"
                    ? "video.openedOnPage"
                    : result === "fallback"
                      ? "video.openedInTab"
                      : result === "needs-toolbar"
                        ? null
                        : "video.error.UNKNOWN",
                );
              })
              .finally(() => setBusy(false));
          }}
        >
          <span
            aria-hidden
            className="size-2.5 rounded-full bg-red-500 ring-[3px] ring-red-500/25"
          />
          {t("video.newRecording")}
        </Button>
        {needsToolbar ? (
          <div
            className="mt-3 rounded-lg border border-primary/30 bg-primary/6 p-3 text-xs leading-relaxed"
            role="status"
          >
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <MousePointerClick
                className="size-3.5 shrink-0 text-primary"
                aria-hidden
              />
              {t("video.needsToolbar.title")}
            </p>
            <p className="mt-1 text-muted-foreground">
              {t("video.needsToolbar.why")}
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-foreground">
              <li>{t("video.needsToolbar.step1")}</li>
              <li>{t("video.needsToolbar.step2")}</li>
            </ol>
            <p className="mt-2 flex items-start gap-1.5 text-muted-foreground">
              <Puzzle className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>
                {t("video.needsToolbar.pin")}
                {shortcut && (
                  <>
                    {" "}
                    {t("video.tabCapture.shortcut")} <Kbd>{shortcut}</Kbd>.
                  </>
                )}
              </span>
            </p>
          </div>
        ) : (
          <p
            className={`mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed ${opened ? "text-foreground" : "text-muted-foreground"}`}
            role={hint ? "status" : undefined}
          >
            {opened && (
              <CircleCheck
                className="mt-px size-3.5 shrink-0 text-primary"
                aria-hidden
              />
            )}
            <span>
              {t(hint ?? "video.recordHint")}
              {!hint && (
                <ShortcutHint shortcut={shortcut} />
              )}
            </span>
          </p>
        )}
      </div>
      <footer className="space-y-2 border-t bg-muted/40 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-medium">{t("video.monthlyVideos")}</span>
          <span className="text-muted-foreground tabular-nums">
            {t("video.usedUnlimited", { used: storageUsed })}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t("video.maxLength", {
            minutes: Math.floor(limits.maxDurationMs / 60_000),
          })}{" "}
          · {t("video.keptForever")}
        </p>
      </footer>
    </section>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border bg-muted px-1 py-px font-sans text-[11px] font-semibold text-foreground">
      {children}
    </kbd>
  );
}

/**
 * The key the browser really bound, not the manifest's suggestion: on macOS it reads `⌥⇧R`, and
 * when the key was taken by another extension nothing is bound, so the panel says so and links
 * to the browser's shortcuts page instead of advertising a key that does nothing.
 */
export function ShortcutHint({
  shortcut,
}: {
  shortcut: string | null | undefined;
}) {
  const { t } = useI18n();
  if (shortcut === undefined) return null;
  if (shortcut)
    return (
      <>
        {" "}
        {t("video.shortcutLabel")} <Kbd>{shortcut}</Kbd>.
      </>
    );
  return (
    <>
      {" "}
      {t("video.shortcutUnset")}{" "}
      <button
        type="button"
        className="font-medium text-primary underline underline-offset-2 hover:text-primary-strong"
        onClick={openShortcutSettings}
      >
        {t("video.shortcutSet")}
      </button>
    </>
  );
}
