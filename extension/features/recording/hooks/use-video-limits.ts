import { useCallback, useEffect } from "react";
import { useAsyncAction } from "@/hooks/use-async-action";
import type { VideoLimits } from "@/types/video";
import { recordingApi } from "../client";
export function useVideoLimits() {
  const load = useCallback(() => recordingApi<VideoLimits>("getLimits"), []);
  const action = useAsyncAction(load, { operation: "videos.getLimits" });
  useEffect(() => {
    void action.execute();
  }, [action.execute]);
  return action;
}
