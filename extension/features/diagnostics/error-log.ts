import { storage } from "#imports";
import { currentSurface } from "./client-info";
import {
  createErrorRef,
  normalizeError,
  sanitizeMeta,
  toErrorCode,
  toOperation,
  type DiagnosticMeta,
  type DiagnosticSurface,
  type ErrorRecord,
} from "./errors";

/** What Settings → Diagnostics copies into a report. Local only, never sent. */
export const LOG_LIMIT = 20;

export const errorLogItem = storage.defineItem<ErrorRecord[]>(
  "local:diagnostics.log",
  { fallback: [] },
);

export interface ReportErrorInput {
  error: unknown;
  /** Replaces the code derived from the error; the error still gives its name. */
  code?: string;
  /** A dotted name, e.g. `videos.getLimits`. Defaults to the error's own. */
  operation?: string;
  surface?: DiagnosticSurface;
  meta?: DiagnosticMeta;
}

let queue: Promise<void> = Promise.resolve();

/**
 * Turns any failure into an ErrorRecord the UI can show right away, and
 * persists it in the background. Never throws: diagnostics must not be what
 * breaks a screen.
 *
 * An error that already carries a ref (the worker reported it and passed the
 * ref back) is returned under that ref and not stored a second time.
 */
export function reportError(input: ReportErrorInput): ErrorRecord {
  const normalized = normalizeError(input.error);
  const operation = toOperation(input.operation) ?? normalized.operation;
  const meta = sanitizeMeta(input.meta);
  const record: ErrorRecord = {
    id: crypto.randomUUID(),
    ref: normalized.ref ?? createErrorRef(),
    occurredAt: new Date().toISOString(),
    surface: input.surface ?? currentSurface(),
    code: toErrorCode(input.code) ?? normalized.code,
    ...(operation ? { operation } : {}),
    ...(normalized.httpStatus ? { httpStatus: normalized.httpStatus } : {}),
    ...(normalized.requestId ? { requestId: normalized.requestId } : {}),
    ...(normalized.errorName ? { errorName: normalized.errorName } : {}),
    ...(meta ? { meta } : {}),
  };
  if (normalized.ref) return record;

  queue = queue.then(() => persist(record)).catch(() => undefined);
  return record;
}

/** Resolves once every record reported so far is stored. For tests. */
export function whenPersisted(): Promise<void> {
  return queue;
}

async function persist(record: ErrorRecord) {
  const log = await errorLogItem.getValue();
  await errorLogItem.setValue([record, ...log].slice(0, LOG_LIMIT));
}

export async function getErrorLog(): Promise<ErrorRecord[]> {
  try {
    return await errorLogItem.getValue();
  } catch {
    return [];
  }
}

export async function clearErrorLog(): Promise<void> {
  await errorLogItem.setValue([]);
}
