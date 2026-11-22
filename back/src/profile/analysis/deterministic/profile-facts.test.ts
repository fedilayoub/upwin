import { describe, expect, it } from 'vitest';
import {
  UNREADABLE_PROFILE_COMPLETENESS,
  type ProfileSnapshot,
} from '../../../profile-snapshots/profile-snapshot.schema';
import {
  classifyAverageResponseTime,
  inspectProfile,
  type TargetJobProfile,
} from './profile-facts';

const target: TargetJobProfile = {
  role: 'Senior React Developer',
  projectTypes: ['SaaS dashboard'],
  clients: ['startups'],
  preferredSkills: ['TypeScript'],
};

function snapshot(
  profile: Partial<ProfileSnapshot['profile']> = {},
): ProfileSnapshot {
  return {
    source: 'manual',
    capturedAt: '2026-08-20T10:00:00.000Z',
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

describe('inspectProfile', () => {
  it('describes an empty profile without throwing', () => {
    expect(inspectProfile(snapshot(), target)).toMatchObject({
      emptyProfile: true,
      presence: {
        title: false,
        overview: false,
        skills: false,
        portfolio: false,
        employment: false,
        education: false,
        certifications: false,
        languages: false,
      },
      counts: { skills: 0, portfolio: 0, employment: 0 },
      approximateTextLengths: { total: 0 },
    });
  });

  it('finds target keywords in normalized profile text', () => {
    const facts = inspectProfile(
      snapshot({
        title: 'Senior React developer for SaaS startups',
        overview: 'I build TypeScript dashboard products.',
      }),
      target,
    );

    expect(facts.targetKeywords.missing).toEqual([]);
    expect(facts.targetKeywords.coverage).toBe(100);
  });

  it('reports duplicate skills case-insensitively', () => {
    const facts = inspectProfile(
      snapshot({ skills: ['React', 'TypeScript', ' react ', 'REACT'] }),
      target,
    );

    expect(facts.duplicates.skills).toEqual(['react']);
  });

  it('maps every captured completeness signal without converting null to absence', () => {
    const facts = inspectProfile(
      {
        ...snapshot(),
        completeness: {
          hasIntroVideo: false,
          hasProfilePhoto: true,
          availabilityBadge: false,
          hoursPerWeek: 'As Needed - Open to Offers',
          avgResponseTime: '12-24 hours',
          idVerified: true,
          verifications: ['ID'],
          licenses: 0,
          linkedAccounts: ['GitHub'],
        },
      },
      target,
    );

    expect(facts.completeness).toEqual({
      hasIntroVideo: false,
      hasProfilePhoto: true,
      availabilityBadge: false,
      hoursPerWeek: 'As Needed - Open to Offers',
      avgResponseTime: '12-24 hours',
      avgResponseTimeIsSlow: true,
      idVerified: true,
      verifications: ['ID'],
      licenses: 0,
      linkedAccounts: ['GitHub'],
    });
    expect(
      inspectProfile(snapshot(), target).completeness.hasIntroVideo,
    ).toBeNull();
  });

  it.each([
    ['within an hour', false],
    ['within a few hours', false],
    ['1 hour', false],
    ['12-24 hours', true],
    ['more than 24 hours', true],
    ['1 day', true],
    ['within 24 hours', false],
    [null, null],
  ] as const)(
    'classifies average response value %s as %s',
    (value, expected) => {
      expect(classifyAverageResponseTime(value)).toBe(expected);
    },
  );
});
