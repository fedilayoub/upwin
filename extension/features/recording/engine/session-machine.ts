import { initialState, type SessionState } from "../protocol";
export type SessionEvent = {
  type:
    | "start"
    | "acquired"
    | "picked"
    | "pick-cancelled"
    | "area-selected"
    | "area-cancelled"
    | "created"
    | "countdown-done"
    | "pause"
    | "resume"
    | "tick"
    | "limit-reached"
    | "stop"
    | "display-ended"
    | "parts-drained"
    | "completed"
    | "cancel"
    | "error"
    | "recover";
  now?: number;
  area?: boolean;
};
export function reduce(state: SessionState, event: SessionEvent): SessionState {
  const phase = state.phase;
  const next = (value: SessionState["phase"]) => ({ ...state, phase: value });
  switch (event.type) {
    case "start":
      return ["idle", "done", "failed"].includes(phase)
        ? { ...initialState, phase: "acquiring" }
        : state;
    case "acquired":
      return phase === "acquiring" ? next("picking") : state;
    case "picked":
      return phase === "picking"
        ? next(event.area ? "selecting-area" : "creating")
        : state;
    case "area-selected":
      return phase === "selecting-area" ? next("creating") : state;
    case "pick-cancelled":
      return phase === "picking" ? { ...initialState } : state;
    case "area-cancelled":
      return phase === "selecting-area" ? { ...initialState } : state;
    case "created":
      return phase === "creating" ? next("countdown") : state;
    case "countdown-done":
      return phase === "countdown"
        ? { ...state, phase: "recording", startedAt: event.now ?? 0 }
        : state;
    case "pause":
      return phase === "recording" ? next("paused") : state;
    case "resume":
      return phase === "paused" ? next("recording") : state;
    case "tick":
      return phase === "recording"
        ? { ...state, elapsedMs: state.elapsedMs + Math.max(0, event.now ?? 0) }
        : state;
    case "limit-reached":
    case "display-ended":
    case "stop":
      return ["recording", "paused"].includes(phase) ? next("stopping") : state;
    case "parts-drained":
      return phase === "stopping" || phase === "uploading"
        ? next("completing")
        : state;
    case "completed":
      return phase === "completing" ? next("done") : state;
    case "cancel":
      return ["done", "idle"].includes(phase) ? state : { ...initialState };
    case "error":
      return next("failed");
    case "recover":
      return ["idle", "failed"].includes(phase) ? next("uploading") : state;
  }
}
