import type { ProbeResult } from './probe-schema';
export function assessRaw(
  probe: ProbeResult,
):
  | { ok: true; transcodeAudioToAac: boolean }
  | { ok: false; reason: 'invalid_media' } {
  const video = probe.streams.filter((s) => s.codec_type === 'video');
  const audio = probe.streams.filter((s) => s.codec_type === 'audio');
  if (
    !probe.format.format_name
      ?.split(',')
      .some((name) => name === 'mp4' || name === 'mov') ||
    video.length !== 1 ||
    video[0]?.codec_name !== 'h264' ||
    audio.length > 1 ||
    audio.some((s) => s.codec_name !== 'aac' && s.codec_name !== 'opus') ||
    probe.streams.some(
      (s) => s.codec_type !== 'video' && s.codec_type !== 'audio',
    )
  )
    return { ok: false, reason: 'invalid_media' };
  return { ok: true, transcodeAudioToAac: audio[0]?.codec_name === 'opus' };
}
export function assessPlayback(
  probe: ProbeResult,
  limits: { maxDurationMs: number },
):
  | { ok: true; durationMs: number; width: number; height: number }
  | { ok: false; reason: 'invalid_media' | 'too_long' } {
  const stream = probe.streams.find((s) => s.codec_type === 'video');
  const durationMs = Math.round(Number(probe.format.duration) * 1000);
  if (
    !stream?.width ||
    !stream.height ||
    stream.width > 1920 ||
    stream.height > 1080 ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0
  )
    return { ok: false, reason: 'invalid_media' };
  if (durationMs > limits.maxDurationMs + 5000)
    return { ok: false, reason: 'too_long' };
  return { ok: true, durationMs, width: stream.width, height: stream.height };
}
