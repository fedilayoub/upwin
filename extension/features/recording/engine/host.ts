import type { EngineApiOp, SessionState } from "../protocol";
export interface EngineHost {
  api<T>(op: EngineApiOp, payload: unknown): Promise<T>;
  emitState(state: SessionState): void;
  now(): number;
}
export class RecordingError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export function errorCode(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : error instanceof Error
      ? error.name === "Error"
        ? error.message
        : error.name
      : "UNKNOWN";
}
export function isRetryable(error: unknown) {
  const code = errorCode(error);
  return (
    error instanceof TypeError ||
    ["NETWORK_ERROR", "API_TIMEOUT", "VIDEO_STORAGE_ERROR"].includes(code)
  );
}
