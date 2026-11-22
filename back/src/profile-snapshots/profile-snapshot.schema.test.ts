import { describe, expect, it } from 'vitest';
import {
  legacyProfileSnapshotSchema,
  parseProfileSnapshot,
  PROFILE_SNAPSHOT_CAPS,
  UNREADABLE_PROFILE_COMPLETENESS,
} from './profile-snapshot.schema';

function validSnapshot(profile: Record<string, unknown> = {}) {
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
      ...profile,
    },
  };
}

describe('profile snapshot schema', () => {
  it('matches the contract and preserves missing optional fields as undefined', () => {
    const parsed = parseProfileSnapshot(validSnapshot());

    expect(parsed.snapshot.profile.overview).toBeUndefined();
    expect(parsed.snapshot.profile.skills).toEqual([]);
    expect(parsed.snapshot.completeness).toEqual(
      UNREADABLE_PROFILE_COMPLETENESS,
    );
    expect(parsed.truncatedFields).toEqual([]);
  });

  it('truncates rather than rejecting fields over a contract cap', () => {
    const parsed = parseProfileSnapshot(
      validSnapshot({
        title: 'x'.repeat(PROFILE_SNAPSHOT_CAPS.title + 1),
        portfolio: [
          {
            description: 'y'.repeat(
              PROFILE_SNAPSHOT_CAPS.portfolioDescription + 1,
            ),
            skills: [],
          },
        ],
      }),
    );

    expect(parsed.snapshot.profile.title).toHaveLength(
      PROFILE_SNAPSHOT_CAPS.title,
    );
    expect(parsed.snapshot.profile.portfolio[0]?.description).toHaveLength(
      PROFILE_SNAPSHOT_CAPS.portfolioDescription,
    );
    expect(parsed.truncatedFields).toEqual([
      'profile.portfolio[0].description',
      'profile.title',
    ]);
  });

  it('rejects missing required arrays and unknown ownership fields', () => {
    expect(() =>
      parseProfileSnapshot({
        source: 'upwork',
        capturedAt: '2026-08-18T12:00:00.000Z',
        profile: { portfolio: [] },
      }),
    ).toThrow('The profile snapshot is invalid.');

    expect(() =>
      parseProfileSnapshot({
        ...validSnapshot(),
        userId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a',
      }),
    ).toThrow('The profile snapshot is invalid.');
  });

  it('rejects missing completeness on writes but defaults it when reading a legacy row', () => {
    const legacySnapshot: Partial<ReturnType<typeof validSnapshot>> =
      validSnapshot();
    delete legacySnapshot.completeness;

    expect(() => parseProfileSnapshot(legacySnapshot)).toThrow(
      'The profile snapshot is invalid.',
    );
    expect(
      legacyProfileSnapshotSchema.parse(legacySnapshot).completeness,
    ).toEqual(UNREADABLE_PROFILE_COMPLETENESS);
  });

  it('preserves readable absence separately from unreadable facts', () => {
    const parsed = parseProfileSnapshot({
      ...validSnapshot(),
      completeness: {
        ...UNREADABLE_PROFILE_COMPLETENESS,
        hasIntroVideo: false,
      },
    });

    expect(parsed.snapshot.completeness.hasIntroVideo).toBe(false);
    expect(parsed.snapshot.completeness.hasProfilePhoto).toBeNull();
  });
});
