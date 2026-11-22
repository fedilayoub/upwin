/** Every multipart upload part but the last is exactly this size. */
export const VIDEO_PART_SIZE_BYTES = 8 * 1024 * 1024;

const MAX_DURATION_MINUTES = 20;
/** 3.8 parts (about 30 MB) per minute of recording. */
const PARTS_PER_MINUTE = 3.8;

/** Longest recording. The extension stops recording when it is reached. */
export const VIDEO_MAX_DURATION_MS = MAX_DURATION_MINUTES * 60_000;

/** Largest raw upload: 76 parts of 8 MiB for a 20-minute recording. */
export const VIDEO_MAX_BYTES =
  Math.ceil(MAX_DURATION_MINUTES * PARTS_PER_MINUTE) * VIDEO_PART_SIZE_BYTES;
