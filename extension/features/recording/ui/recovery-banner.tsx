import { CloudUpload, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/i18n-context";
import type { SessionState } from "../protocol";
import { sendRecording } from "../client";
export function RecoveryBanner({
  sessions,
}: {
  sessions: SessionState["recoveries"];
}) {
  const { t, locale } = useI18n();
  const recover = (sessionId: string, action: "upload" | "discard") =>
    void sendRecording({
      target: "background",
      type: "recording/recover",
      sessionId,
      action,
    });
  return (
    <>
      {sessions.map((session) => (
        <aside
          className="flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4"
          key={session.sessionId}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warning/15 text-warning-foreground">
            <TriangleAlert className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {t("video.recovery", {
                time: new Date(session.createdAt).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </p>
            <div className="mt-3 flex items-center gap-1">
              <Button
                size="sm"
                className="min-w-0 gap-1.5"
                onClick={() => recover(session.sessionId, "upload")}
              >
                <CloudUpload className="size-3.5" aria-hidden />
                {t("video.recoverUpload")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => recover(session.sessionId, "discard")}
              >
                {t("video.discard")}
              </Button>
            </div>
          </div>
        </aside>
      ))}
    </>
  );
}
