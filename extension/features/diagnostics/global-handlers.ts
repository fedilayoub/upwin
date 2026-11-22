import { reportError } from "./error-log";

type ErrorTarget = Pick<typeof globalThis, "addEventListener">;

let installed = false;

/**
 * Catches what no screen handled: a thrown error outside React, a rejected
 * promise nobody awaited. Both are reported with a fixed code so they group,
 * and the error's own name says what kind they were.
 */
export function installGlobalErrorHandlers(target: ErrorTarget = globalThis) {
  if (installed) return;
  installed = true;
  target.addEventListener("error", (event: Event) => {
    const error = "error" in event ? (event as ErrorEvent).error : undefined;
    reportError({
      error,
      code: "UNHANDLED_ERROR",
      operation: "global.error",
    });
  });
  target.addEventListener("unhandledrejection", (event: Event) => {
    reportError({
      error: (event as PromiseRejectionEvent).reason,
      code: "UNHANDLED_REJECTION",
      operation: "global.rejection",
    });
  });
}
