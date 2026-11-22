// Mirrors the API's video responses (back/src/videos).
export type VideoStatus = "uploading" | "processing" | "ready" | "failed";

export type VideoSourceKind = "screen" | "window" | "tab" | "area";
// The surface Chrome actually granted, from track.getSettings().displaySurface:
// monitor → 'screen', window → 'window', browser → 'tab'.
// 'area' whenever a crop was applied, whatever the surface.

export type VideoFailureReason =
  | "upload_abandoned" // still uploading 24 h after create
  | "invalid_media" // ffprobe rejected the container, codecs or dimensions
  | "too_long" // probed duration > plan max + 5 s
  | "processing_error"; // remux, poster or storage failed 3 times

export interface Video {
  id: string; // uuid
  slug: string; // 12 chars, [0-9A-Za-z]
  shareUrl: string; // `${APP_URL}/v/${slug}`, known from create onwards
  title: string; // 1..120 chars, trimmed
  status: VideoStatus;
  failureReason: VideoFailureReason | null; // non-null iff status === 'failed'
  sourceKind: VideoSourceKind;
  hasCamera: boolean;
  hasAudio: boolean;
  durationMs: number | null; // probed server-side; null until ready
  width: number | null; // null until ready
  height: number | null;
  sizeBytes: number | null; // size of playback.mp4; null until ready
  thumbnailUrl: string | null; // presigned GET, 1 h TTL; null until ready
  jobSnapshotId: string | null; // set when recorded from the proposal screen
  viewCount: number; // integer >= 0; the owner's own plays are never counted
  finishedViews: number; // views that reached the end
  averageWatchedPercent: number | null; // 0..100; null before any tracked view
  watchTimeMs: number; // distinct video time watched, summed over views
  lastViewedAt: string | null; // ISO 8601
  createdAt: string;
  readyAt: string | null;
}

export interface VideoLimits {
  available: boolean; // false = VIDEO_NOT_CONFIGURED: no bucket; never call create
  storage: { usedBytes: number }; // no total cap; a video is kept until deleted
  maxDurationMs: number;
  maxBytes: number;
}

export interface CreateVideoRequest {
  title?: string; // default on the server: "Recording · <MMM d, yyyy>" (UTC)
  sourceKind: VideoSourceKind;
  hasCamera: boolean;
  hasAudio: boolean;
  mimeType: "video/mp4"; // the only accepted value in v1
  jobSnapshotId?: string | null; // must belong to the caller if present
}

export interface CreateVideoResponse {
  video: Video; // status 'uploading'
  upload: {
    partSizeBytes: number; // 8 MiB = 8_388_608. Every part except the last is EXACTLY this size
    maxParts: number; // ceil(maxBytes / partSizeBytes)
    maxBytes: number;
    maxDurationMs: number;
  };
}

export interface PresignPartsRequest {
  partNumbers: number[]; // 1..maxParts, unique, 1..10 entries per call
}

export interface PresignPartsResponse {
  parts: Array<{
    partNumber: number;
    url: string; // PUT the part's bytes. No extra headers. Read the ETag response header
    expiresAt: string; // ISO 8601, at most 1 h from issue
  }>;
}

export interface ListUploadedPartsResponse {
  // used to resume after a crash or a reload
  parts: Array<{ partNumber: number; sizeBytes: number; etag: string }>;
}

export interface CompleteVideoRequest {
  parts: Array<{ partNumber: number; etag: string }>; // all of them, ascending
  clientDurationMs: number; // informational; the server's probe is authoritative
}

export interface UpdateVideoRequest {
  title: string; // 1..120 chars after trim
}

export interface VideoListResponse {
  items: Video[]; // newest first; status 'uploading' excluded
  nextCursor: string | null; // opaque
}
