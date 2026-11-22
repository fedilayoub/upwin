import { useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  ClipboardCopy,
  LoaderCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConnection } from "@/features/connection/connection-context";
import { readConnection } from "@/features/connection/connection-store";
import type { TranslationKey } from "@/features/i18n/dictionaries/en";
import { useI18n } from "@/features/i18n/i18n-context";
import {
  buildDiagnosticsReport,
  runDiagnostics,
  type DiagnosticsCheck,
} from "./checks";
import { getClientInfo } from "./client-info";
import { getErrorLog } from "./error-log";

type Tone = "success" | "warning" | "secondary";

const SESSION_LABEL: Record<string, [TranslationKey, Tone]> = {
  set: ["diagnostics.status.tokenSet", "success"],
  unset: ["diagnostics.status.tokenUnset", "secondary"],
  error: ["diagnostics.status.error", "warning"],
};

/**
 * Settings → Diagnostics. Shows what a bug report needs (versions, the token
 * state, the service) and copies it, with the recent error refs, as plain text
 * to paste into an issue. No page content, no token.
 */
export function DiagnosticsSection() {
  const { t } = useI18n();
  const { getToken } = useConnection();
  const [check, setCheck] = useState<DiagnosticsCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const client = getClientInfo();

  const run = async () => {
    setChecking(true);
    try {
      const result = await runDiagnostics({ getToken });
      setCheck(result);
      return result;
    } finally {
      setChecking(false);
    }
  };

  const copy = async () => {
    setCopying(true);
    try {
      const result = check ?? (await run());
      const [errors, connection] = await Promise.all([
        getErrorLog(),
        readConnection(),
      ]);
      await navigator.clipboard.writeText(
        buildDiagnosticsReport({
          client,
          apiUrl: connection.apiUrl,
          check: result,
          errors,
        }),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard refused: nothing to show beyond the button staying as it was.
    } finally {
      setCopying(false);
    }
  };

  const status = (value: string) => {
    const [key, tone] = SESSION_LABEL[value] ?? [
      "diagnostics.status.notChecked",
      "secondary",
    ];
    return <Badge variant={tone}>{t(key)}</Badge>;
  };

  return (
    <Card className="overflow-hidden" data-diagnostics>
      {/* Closed by default: only needed when something breaks. `<details>` keeps it keyboard and
          screen-reader accessible with no state, like the profile breakdown's rows. */}
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
          <Activity className="size-3.5" aria-hidden />
          {t("diagnostics.title")}
          <ChevronDown
            className="ml-auto size-4 transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <CardContent className="space-y-4 px-4 pt-0 pb-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("diagnostics.description")}
          </p>

          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-xs">
            <Row label={t("diagnostics.version")}>
              <span className="font-mono">{client.version}</span>
            </Row>
            <Row label={t("diagnostics.browser")}>{client.browser}</Row>
            <Row label={t("diagnostics.extensionId")}>
              <span className="truncate font-mono">
                {client.extensionId ?? "—"}
              </span>
            </Row>
            <Row label={t("diagnostics.serviceStatus")}>
              {check ? (
                <Badge variant={check.api.status === "ok" ? "success" : "warning"}>
                  {check.api.status === "ok"
                    ? `${t("diagnostics.status.ok")} · ${check.api.latencyMs ?? "?"} ms`
                    : check.api.status === "unreachable"
                      ? t("diagnostics.status.unreachable")
                      : `${t("diagnostics.status.error")} ${check.api.httpStatus ?? ""}`}
                </Badge>
              ) : (
                <Badge variant="secondary">
                  {t("diagnostics.status.notChecked")}
                </Badge>
              )}
            </Row>
            <Row label={t("diagnostics.apiToken")}>
              {check ? status(check.apiToken) : status("")}
            </Row>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={checking}
              onClick={() => void run()}
            >
              {checking ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Activity className="size-3.5" aria-hidden />
              )}
              {checking ? t("diagnostics.checking") : t("diagnostics.runCheck")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={copying}
              onClick={() => void copy()}
            >
              {copying ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              ) : copied ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <ClipboardCopy className="size-3.5" aria-hidden />
              )}
              {copied ? t("diagnostics.copied") : t("diagnostics.copyReport")}
            </Button>
          </div>
        </CardContent>
      </details>
    </Card>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end text-right">
        {children}
      </dd>
    </>
  );
}
