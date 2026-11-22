import { describe, expect, it } from 'vitest';
import {
  UNREADABLE_PROFILE_COMPLETENESS,
  type ProfileSnapshot,
} from '@/features/upwork/profile/schema';
import {
  profileCaptureChips,
  profileCompletenessChips,
} from './capture-evidence';

describe('profile capture evidence', () => {
  it('derives factual chips from a full snapshot', () => {
    expect(profileCaptureChips(fullSnapshot())).toEqual([
      'Title',
      'Overview',
      '2 skills',
      '2 portfolio items',
      '2 roles',
      '2 certifications',
      '2 languages',
    ]);
    expect(profileCompletenessChips(fullSnapshot().completeness)).toEqual([
      'Photo',
      'Intro video',
      'ID verified',
      '2 verifications',
      '2 linked accounts',
    ]);
  });

  it('omits empty fields instead of claiming zero-count evidence', () => {
    const snapshot: ProfileSnapshot = {
      source: 'upwork',
      capturedAt: '2026-09-04T10:00:00.000Z',
      completeness: UNREADABLE_PROFILE_COMPLETENESS,
      profile: {
        certifications: [],
        education: [],
        employment: [],
        languages: [],
        portfolio: [],
        skills: [],
      },
    };

    expect(profileCaptureChips(snapshot)).toEqual([]);
    expect(profileCaptureChips(snapshot)).not.toContain('0 skills');
  });

  it('uses singular labels for one item', () => {
    const snapshot = fullSnapshot();
    snapshot.profile.skills = snapshot.profile.skills.slice(0, 1);
    snapshot.profile.portfolio = snapshot.profile.portfolio.slice(0, 1);
    snapshot.profile.employment = snapshot.profile.employment.slice(0, 1);
    snapshot.profile.certifications = snapshot.profile.certifications.slice(0, 1);
    snapshot.profile.languages = snapshot.profile.languages.slice(0, 1);
    snapshot.completeness.verifications = ['Identity'];
    snapshot.completeness.linkedAccounts = ['GitHub'];

    expect(profileCaptureChips(snapshot)).toContain('1 skill');
    expect(profileCaptureChips(snapshot)).toContain('1 portfolio item');
    expect(profileCaptureChips(snapshot)).toContain('1 role');
    expect(profileCaptureChips(snapshot)).toContain('1 certification');
    expect(profileCaptureChips(snapshot)).toContain('1 language');
    expect(profileCompletenessChips(snapshot.completeness)).toContain(
      '1 verification',
    );
    expect(profileCompletenessChips(snapshot.completeness)).toContain(
      '1 linked account',
    );
  });

  it('renders nothing for unreadable completeness fields', () => {
    expect(profileCompletenessChips(UNREADABLE_PROFILE_COMPLETENESS)).toEqual(
      [],
    );
  });
});

function fullSnapshot(): ProfileSnapshot {
  return {
    source: 'upwork',
    capturedAt: '2026-09-04T10:00:00.000Z',
    completeness: {
      hasIntroVideo: true,
      hasProfilePhoto: true,
      availabilityBadge: true,
      hoursPerWeek: 'More than 30 hrs/week',
      avgResponseTime: '< 24 hours',
      idVerified: true,
      verifications: ['Identity', 'Phone'],
      licenses: 1,
      linkedAccounts: ['GitHub', 'Stack Overflow'],
    },
    profile: {
      title: 'Senior Frontend Developer',
      overview: 'I build accessible SaaS products.',
      skills: ['TypeScript', 'React'],
      portfolio: [{ title: 'One', skills: [] }, { title: 'Two', skills: [] }],
      employment: [{ title: 'One' }, { title: 'Two' }],
      education: [],
      certifications: [{ name: 'One' }, { name: 'Two' }],
      languages: [{ name: 'English' }, { name: 'French' }],
    },
  };
}
