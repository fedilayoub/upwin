/**
 * One normalized shape for every failure the extension shows or reports. A
 * record carries only allowlisted tokens: codes, operation names, HTTP
 * status, the API's request id. Never a page URL,
 * page text, a token, or a free-text message.
 */
export type DiagnosticSurface =
  | "sidepanel"
  | "worker"
  | "offscreen"
  | "recorder"
  | "launcher";

export type DiagnosticMeta = Record<string, string | number | boolean | null>;

export interface ErrorRecord {
  /** Unique per occurrence; the backend dedupes a retried batch on it. */
  id: string;
  /** What the user reads and quotes back, e.g. `E-7F3A2C`. */
  ref: string;
  occurredAt: string;
  surface: DiagnosticSurface;
  code: string;
  operation?: string;
  httpStatus?: number;
  /** The API's `X-Request-Id`, when the request reached the API. */
  requestId?: string;
  errorName?: string;
  meta?: DiagnosticMeta;
}

export interface NormalizedError {
  code: string;
  httpStatus?: number;
  requestId?: string;
  errorName?: string;
  /** Set when another context already reported this failure under that ref. */
  ref?: string;
  operation?: string;
}

const REF_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const OPERATION_PATTERN = /^[A-Za-z][A-Za-z0-9._:/-]{0,79}$/;
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const REF_PATTERN = /^E-[0-9A-Z]{6}$/;
const META_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;

export function createErrorRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `E-${Array.from(bytes, (byte) => REF_ALPHABET[byte % 36]).join("")}`;
}

export function isErrorRef(value: unknown): value is string {
  return typeof value === "string" && REF_PATTERN.test(value);
}

/** `NotAllowedError` → `NOT_ALLOWED_ERROR`; anything unusable → null. */
export function toErrorCode(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const code = value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return CODE_PATTERN.test(code) ? code : null;
}

export function toOperation(value: unknown): string | undefined {
  return typeof value === "string" && OPERATION_PATTERN.test(value)
    ? value
    : undefined;
}

function field(error: unknown, key: string): unknown {
  return typeof error === "object" && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;
}

function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  return /failed to fetch|networkerror|load failed|network request failed/i.test(
    error.message,
  );
}

/**
 * Maps anything thrown to a code plus the context worth keeping. Order matters:
 * an explicit `code` wins, then well-known shapes, then the error's name.
 */
export function normalizeError(error: unknown): NormalizedError {
  const status = field(error, "status");
  const requestId = field(error, "requestId");
  const ref = field(error, "ref");
  const name =
    error instanceof Error && NAME_PATTERN.test(error.name)
      ? error.name
      : undefined;
  const base: Omit<NormalizedError, "code"> = {
    ...(typeof status === "number" && status >= 100 && status <= 599
      ? { httpStatus: status }
      : {}),
    ...(typeof requestId === "string" && REQUEST_ID_PATTERN.test(requestId)
      ? { requestId }
      : {}),
    ...(isErrorRef(ref) ? { ref } : {}),
    ...(name ? { errorName: name } : {}),
    ...(toOperation(field(error, "operation"))
      ? { operation: toOperation(field(error, "operation")) }
      : {}),
  };

  const explicit = toErrorCode(field(error, "code"));
  if (explicit) return { ...base, code: explicit };
  if (typeof error === "string") return { ...base, code: toErrorCode(error) ?? "UNKNOWN" };
  if (isNetworkFailure(error)) return { ...base, code: "NETWORK_ERROR" };
  if (name === "ZodError") return { ...base, code: "INVALID_RESPONSE" };
  if (name === "AbortError" || name === "TimeoutError")
    return { ...base, code: "TIMEOUT" };
  if (base.httpStatus) return { ...base, code: `HTTP_${base.httpStatus}` };
  if (name && name !== "Error") return { ...base, code: toErrorCode(name) ?? "UNKNOWN" };
  return { ...base, code: "UNEXPECTED" };
}

export function sanitizeMeta(meta: DiagnosticMeta | undefined): DiagnosticMeta | undefined {
  if (!meta) return undefined;
  const entries = Object.entries(meta)
    .filter(([key]) => META_KEY_PATTERN.test(key))
    .slice(0, 12)
    .map(([key, value]) => [
      key,
      typeof value === "string"
        ? value.slice(0, 80)
        : typeof value === "number" && !Number.isFinite(value)
          ? null
          : value,
    ]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** Plain text the user can paste into a support message. */
export function formatErrorDetails(
  record: ErrorRecord,
  context: { version: string; browser: string },
): string {
  return [
    `upwin error ${record.ref}`,
    `code: ${record.code}`,
    record.operation ? `operation: ${record.operation}` : null,
    record.httpStatus ? `http status: ${record.httpStatus}` : null,
    record.requestId ? `request id: ${record.requestId}` : null,
    `where: ${record.surface}`,
    `when: ${record.occurredAt}`,
    `version: ${context.version} (${context.browser})`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
