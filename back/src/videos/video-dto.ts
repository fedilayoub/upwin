import type { VideoRow } from '../database/schema';
import type { VideoStorage } from './storage/video-storage';
import type { VideoWatchStats } from './videos.repository';
export async function videoDto(
  row: VideoRow,
  appUrl: string,
  storage: VideoStorage | null,
  stats: VideoWatchStats,
) {
  return {
    id: row.id,
    slug: row.slug,
    shareUrl: `${appUrl.replace(/\/$/, '')}/v/${row.slug}`,
    title: row.title,
    status: row.status,
    failureReason: row.failureReason,
    sourceKind: row.sourceKind,
    hasCamera: row.hasCamera,
    hasAudio: row.hasAudio,
    durationMs: row.durationMs,
    width: row.width,
    height: row.height,
    sizeBytes: row.sizeBytes,
    thumbnailUrl:
      row.playbackReady && storage
        ? await storage.presignGet(`${row.storagePrefix}poster.jpg`, 3600)
        : null,
    jobSnapshotId: row.jobSnapshotId,
    viewCount: row.viewCount,
    finishedViews: stats.finishedViews,
    averageWatchedPercent: stats.averageWatchedPercent,
    watchTimeMs: stats.watchTimeMs,
    lastViewedAt: row.lastViewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    readyAt: row.readyAt?.toISOString() ?? null,
  };
}
export type Video = Awaited<ReturnType<typeof videoDto>>;
