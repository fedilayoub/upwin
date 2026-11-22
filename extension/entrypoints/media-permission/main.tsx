import { useEffect } from "react";
import { browser } from "wxt/browser";
import { useI18n } from "@/features/i18n/i18n-context";
import { mountRecordingPage } from "@/features/recording/page-root";
import { releaseAll } from "@/features/recording/engine/sources";
export async function requestPermissions() {
  const request = async (kind: "audio" | "video"): Promise<PermissionState> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        [kind]: true,
      });
      releaseAll(stream);
      return "granted";
    } catch (error: unknown) {
      return error instanceof DOMException && error.name === "NotAllowedError"
        ? "denied"
        : "prompt";
    }
  };
  const microphone = await request("audio"),
    camera = await request("video");
  await browser.runtime.sendMessage({
    target: "background",
    type: "media-permission/result",
    microphone,
    camera,
  });
}
function PermissionPage() {
  const { t } = useI18n();
  useEffect(() => {
    void requestPermissions().finally(() => window.close());
  }, []);
  return (
    <main className="mx-auto max-w-lg space-y-3 p-8">
      <h1 className="text-xl font-semibold">{t("video.allowMedia")}</h1>
      <p>{t("video.permissionPage")}</p>
    </main>
  );
}
void mountRecordingPage(<PermissionPage />);
