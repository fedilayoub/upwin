import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assessPlayback, assessRaw } from './assess-media';
import { probeSchema } from './probe-schema';
describe('media validation', () => {
  function fixture(name: string) {
    return probeSchema.parse(
      JSON.parse(
        readFileSync(`test/fixtures/ffprobe/${name}.json`, 'utf8'),
      ) as unknown,
    );
  }
  it.each(['ok-h264-aac', 'ok-h264-opus'])('accepts %s', (name) => {
    const probe = fixture(name);
    expect(assessRaw(probe)).toEqual({
      ok: true,
      transcodeAudioToAac: name.endsWith('opus'),
    });
    expect(assessPlayback(probe, { maxDurationMs: 300000 })).toEqual({
      ok: true,
      durationMs: 6000,
      width: 1280,
      height: 720,
    });
  });
  it.each(['vp9', 'two-video-streams', 'subtitle-stream'])(
    'rejects raw %s',
    (name) => {
      expect(assessRaw(fixture(name))).toEqual({
        ok: false,
        reason: 'invalid_media',
      });
    },
  );
  it.each([
    ['too-long', 'too_long'],
    ['4k', 'invalid_media'],
    ['no-duration', 'invalid_media'],
  ])('rejects playback %s', (name, reason) => {
    expect(assessPlayback(fixture(name), { maxDurationMs: 300000 })).toEqual({
      ok: false,
      reason,
    });
  });
  it('accepts video without audio and rejects extra audio and invalid container', () => {
    const probe = fixture('ok-h264-aac');
    expect(assessRaw({ ...probe, streams: probe.streams.slice(0, 1) }).ok).toBe(
      true,
    );
    expect(
      assessRaw({
        ...probe,
        streams: [...probe.streams, { codec_type: 'audio', codec_name: 'aac' }],
      }).ok,
    ).toBe(false);
    expect(
      assessRaw({ ...probe, format: { format_name: 'matroska' } }).ok,
    ).toBe(false);
  });
  it('enforces the 5s tolerance and rejects non-finite duration', () => {
    const probe = fixture('ok-h264-aac');
    expect(
      assessPlayback(
        { ...probe, format: { duration: '305' } },
        { maxDurationMs: 300000 },
      ).ok,
    ).toBe(true);
    expect(
      assessPlayback(
        { ...probe, format: { duration: 'Infinity' } },
        { maxDurationMs: 300000 },
      ).ok,
    ).toBe(false);
  });
});
