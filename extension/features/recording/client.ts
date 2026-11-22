import { browser } from "wxt/browser";
import { z } from "zod";
import {
  sidepanelSchema,
  apiRequestSchema,
  type EngineApiOp,
  type BackgroundMessage,
} from "./protocol";
import {
  createSchema,
  limitsSchema,
  listSchema,
  presignSchema,
  uploadedSchema,
  videoSchema,
} from "@/services/videos";
import { RecordingError } from "./engine/host";
export function parseApiData(op: EngineApiOp, data: unknown): unknown {
  switch (op) {
    case "getLimits":
      return limitsSchema.parse(data);
    case "create":
      return createSchema.parse(data);
    case "presignParts":
      return presignSchema.parse(data);
    case "listUploadedParts":
      return uploadedSchema.parse(data);
    case "complete":
    case "get":
    case "rename":
      return z.object({ video: videoSchema }).parse(data);
    case "list":
      return listSchema.parse(data);
    case "abortUpload":
    case "remove":
      return z.undefined().parse(data);
  }
}
/** Carries what the worker knew about a failed call, so the UI shows its ref. */
export class RecordingApiError extends RecordingError {
  constructor(
    code: string,
    readonly operation: string,
    readonly ref?: string,
    readonly status?: number,
    readonly requestId?: string,
  ) {
    super(code);
    this.name = "RecordingApiError";
  }
}

/**
 * The video no longer exists for this user: deleted from the web app or another panel. The
 * backend answers 404 `VIDEO_NOT_FOUND` for it, which is a final answer, not a failure to retry.
 */
export function isVideoGone(error: unknown): boolean {
  return (
    error instanceof RecordingApiError &&
    (error.code === "VIDEO_NOT_FOUND" || error.status === 404)
  );
}

const WORKER_REPLY_TIMEOUT_MS = 20_000;

/**
 * One message to the worker, bounded. A worker that is restarting, crashed, or
 * whose listener did not answer becomes a typed error instead of a hang.
 */
async function askWorker(
  message: unknown,
  operation: string,
  timeoutMs: number,
): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new RecordingApiError("WORKER_NO_REPLY", operation)),
      timeoutMs,
    );
  });
  try {
    const reply = await Promise.race([
      browser.runtime.sendMessage(message).catch((error: unknown) => {
        // "Receiving end does not exist" / "message port closed": no worker answered.
        throw error instanceof RecordingApiError
          ? error
          : new RecordingApiError("WORKER_UNAVAILABLE", operation);
      }),
      timeout,
    ]);
    if (reply === undefined || reply === null)
      throw new RecordingApiError("WORKER_NO_REPLY", operation);
    return reply;
  } finally {
    clearTimeout(timer);
  }
}

export async function recordingApi<T>(
  op: EngineApiOp,
  payload: unknown = {},
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const request = apiRequestSchema.parse({ op, payload });
  const operation = `videos.${op}`;
  let raw: unknown;
  for (let attempt = 0; ; attempt += 1) {
    const requestId = crypto.randomUUID();
    try {
      raw = await askWorker(
        { ...request, target: "background", type: "engine/api", requestId },
        operation,
        options.timeoutMs ?? WORKER_REPLY_TIMEOUT_MS,
      );
    } catch (error: unknown) {
      // A worker that was asleep or restarting usually answers the second time.
      if (attempt === 0 && error instanceof RecordingApiError) continue;
      throw error;
    }
    const response = sidepanelSchema.safeParse(raw);
    if (
      !response.success ||
      response.data.type !== "api/result" ||
      response.data.requestId !== requestId
    )
      throw new RecordingApiError("INVALID_API_RESULT", operation);
    if (!response.data.ok) {
      const error = response.data.error;
      throw new RecordingApiError(
        error?.code ?? "UNKNOWN",
        operation,
        error?.ref,
        error?.status,
        error?.apiRequestId,
      );
    }
    return parseApiData(op, response.data.data) as T;
  }
}

export const sendRecording = (
  message: Exclude<
    BackgroundMessage,
    {
      type: "engine/api" | "engine/state" | "engine/closed";
    }
  >,
) => browser.runtime.sendMessage(message);

/** Ask the worker to open the in-page recorder on the active tab. */
export async function openRecorder(
  intent: { jobSnapshotId: string; title: string } | null,
): Promise<"page" | "fallback" | "needs-toolbar" | "failed"> {
  const result: unknown = await browser.runtime
    .sendMessage({ target: "background", type: "recorder/open", intent })
    .catch(() => null);
  const parsed = z
    .object({ opened: z.enum(["page", "fallback", "needs-toolbar"]) })
    .safeParse(result);
  return parsed.success ? parsed.data.opened : "failed";
}
