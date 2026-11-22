import { describe, expect, it } from 'vitest';
import {
  parseProfileSnapshot,
  PROFILE_SNAPSHOT_CAPS,
  UNREADABLE_PROFILE_COMPLETENESS,
} from './schema';

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    source: 'upwork',
    capturedAt: '2026-08-18T12:00:00.000Z',
    completeness: UNREADABLE_PROFILE_COMPLETENESS,
    profile: {
      skills: [],
      portfolio: [],
      employment: [],
      education: [],
      certifications: [],
      languages: [],
      ...overrides,
    },
  };
}

describe('profileSnapshotSchema', () => {
  it('truncates over-cap fields and reports the affected path', () => {
    const result = parseProfileSnapshot(
      snapshot({ overview: 'x'.repeat(PROFILE_SNAPSHOT_CAPS.overview + 1) }),
    );

    expect(result.snapshot.profile.overview).toHaveLength(
      PROFILE_SNAPSHOT_CAPS.overview,
    );
    expect(result.truncatedFields).toEqual(['profile.overview']);
  });

  it('rejects missing required arrays and empty optional strings', () => {
    expect(() =>
      parseProfileSnapshot({
        source: 'upwork',
        capturedAt: '2026-08-18T12:00:00.000Z',
        profile: { portfolio: [] },
      }),
    ).toThrow('We could not read your profile');
    expect(() => parseProfileSnapshot(snapshot({ overview: '   ' }))).toThrow(
      'We could not read your profile',
    );
  });

  it('rejects an older capture with no completeness block as version skew', () => {
    const olderSnapshot: Partial<ReturnType<typeof snapshot>> = snapshot();
    delete olderSnapshot.completeness;

    expect(() => parseProfileSnapshot(olderSnapshot)).toThrow(
      'We could not read your profile',
    );
  });

  it('keeps readable absence distinct from an unreadable field', () => {
    const result = parseProfileSnapshot({
      ...snapshot(),
      completeness: {
        ...UNREADABLE_PROFILE_COMPLETENESS,
        hasIntroVideo: false,
      },
    });

    expect(result.snapshot.completeness.hasIntroVideo).toBe(false);
    expect(result.snapshot.completeness.hasProfilePhoto).toBeNull();
  });
});
