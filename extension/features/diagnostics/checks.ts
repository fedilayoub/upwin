import { resolveApiBaseUrl } from "@/features/connection/connection-store";
import type { TokenProvider } from "@/services/api";
import type { ClientInfo } from "./client-info";
import type { ErrorRecord } from "./errors";

/** Whether this extension sends an API token. Never the token itself. */
export type ApiTokenState = "set" | "unset" | "error";

export interface DiagnosticsCheck {
  checkedAt: string;
  api: {
    status: "ok" | "error" | "unreachable";
    httpStatus?: number;
    latencyMs?: number;
    requestId?: string;
  };
  apiToken: ApiTokenState;
}

export interface DiagnosticsDependencies {
  getToken: TokenProvider;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** Runs every check in parallel. Never throws; each check reports its own failure. */
export async function runDiagnostics(
  deps: DiagnosticsDependencies,
): Promise<DiagnosticsCheck> {
  const now = deps.now ?? Date.now;
  const fetchImpl =
    deps.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));

  const api = (async (): Promise<DiagnosticsCheck["api"]> => {
    const started = now();
    try {
      const response = await fetchImpl(`${await resolveApiBaseUrl()}/health`, {
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      const requestId = response.headers.get("x-request-id") ?? undefined;
      return {
        status: response.ok ? "ok" : "error",
        httpStatus: response.status,
        latencyMs: now() - started,
        ...(requestId ? { requestId } : {}),
      };
    } catch {
      return { status: "unreachable" };
    }
  })();

  const token = deps
    .getToken()
    .then((value): ApiTokenState => (value ? "set" : "unset"))
    .catch((): ApiTokenState => "error");

  const [apiResult, apiToken] = await Promise.all([api, token]);

  return {
    checkedAt: new Date(now()).toISOString(),
    api: apiResult,
    apiToken,
  };
}

/**
 * Plain text for a support message. No email, no page content, no token:
 * versions, ids, states and error codes only.
 */
export function buildDiagnosticsReport(input: {
  client: ClientInfo;
  apiUrl: string;
  check: DiagnosticsCheck | null;
  errors: ErrorRecord[];
}): string {
  const { client, check, errors } = input;
  const lines = [
    "upwin diagnostics",
    `version: ${client.version}`,
    `browser: ${client.browser}`,
    `extension id: ${client.extensionId ?? "n/a"}`,
    `service: ${input.apiUrl}`,
  ];
  if (check) {
    lines.push(
      `checked at: ${check.checkedAt}`,
      `service status: ${check.api.status}${check.api.httpStatus ? ` (${check.api.httpStatus}, ${check.api.latencyMs ?? "?"} ms)` : ""}${check.api.requestId ? ` request id ${check.api.requestId}` : ""}`,
      // Never "token: …": the report must not even look like it carries one.
      `api token configured: ${check.apiToken === "set" ? "yes" : check.apiToken === "unset" ? "no" : "error"}`,
    );
  } else {
    lines.push("checks: not run");
  }
  lines.push(`recent errors (${errors.length}):`);
  for (const error of errors.slice(0, 10)) {
    lines.push(
      `  ${error.ref} ${error.occurredAt} ${error.surface} ${error.code}` +
        (error.operation ? ` op=${error.operation}` : "") +
        (error.httpStatus ? ` status=${error.httpStatus}` : "") +
        (error.requestId ? ` request=${error.requestId}` : ""),
    );
  }
  return lines.join("\n");
}
