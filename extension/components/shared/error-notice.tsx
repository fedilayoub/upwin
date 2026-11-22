import { useEffect, useState } from "react";
import { Check, CircleAlert, Copy, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClientInfo } from "@/features/diagnostics/client-info";
import {
  formatErrorDetails,
  type ErrorRecord,
} from "@/features/diagnostics/errors";
import type { TranslationKey } from "@/features/i18n/dictionaries/en";
import { useI18n } from "@/features/i18n/i18n-context";
import { cn } from "@/lib/utils";

/**
 * Infrastructure failures get a message that says what to do; business errors
 * (missing context, a validation) keep the message the screen or the API gave.
 */
export function errorMessageKey(
  failure: Pick<ErrorRecord, "code" | "httpStatus"> | null | undefined,
): TranslationKey | null {
  if (!failure) return null;
  switch (failure.code) {
    case "NO_SESSION":
    case "UNAUTHENTICATED":
      return "errors.session";
    case "NETWORK_ERROR":
      return "errors.network";
    case "WORKER_NO_REPLY":
    case "WORKER_UNAVAILABLE":
    case "INVALID_API_RESULT":
      return "errors.worker";
    case "TIMEOUT":
    case "API_TIMEOUT":
      return "errors.timeout";
    case "INVALID_RESPONSE":
      return "errors.invalidResponse";
    case "FORBIDDEN":
      return "errors.forbidden";
    case "INTERNAL_ERROR":
      return "errors.server";
  }
  if (failure.httpStatus !== undefined && failure.httpStatus >= 500)
    return "errors.server";
  return null;
}

export function ErrorNotice({
  failure,
  message,
  onRetry,
  className,
}: {
  failure: ErrorRecord | null | undefined;
  /** The screen's own message, used when the code has no better one. */
  message?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const key = errorMessageKey(failure);
  const text = key ? t(key) : (message ?? t("errors.generic"));

  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive",
        className,
      )}
    >
      <p className="flex items-start gap-2.5">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="min-w-0">{text}</span>
      </p>
      {failure || onRetry ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 pl-6.5">
          {onRetry ? (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RotateCw className="size-3.5" aria-hidden />
              {t("errors.retry")}
            </Button>
          ) : null}
          {failure ? <ErrorReference failure={failure} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** "Ref E-7F3A2C · Copy details": what a user quotes to support. */
export function ErrorReference({
  failure,
  className,
}: {
  failure: ErrorRecord;
  className?: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs text-muted-foreground",
        className,
      )}
      title={t("errors.refHelp")}
    >
      <span className="font-mono tabular-nums">
        {t("errors.ref", { ref: failure.ref })}
      </span>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => {
          void navigator.clipboard
            .writeText(formatErrorDetails(failure, getClientInfo()))
            .then(() => setCopied(true))
            .catch(() => undefined);
        }}
      >
        {copied ? (
          <Check className="size-3" aria-hidden />
        ) : (
          <Copy className="size-3" aria-hidden />
        )}
        {copied ? t("errors.copied") : t("errors.copyDetails")}
      </button>
    </span>
  );
}
