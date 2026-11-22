import { describe, expect, it } from 'vitest';
import {
  UNREADABLE_PROFILE_COMPLETENESS,
  type ProfileSnapshot,
} from './profile-snapshot.schema';
import { diffProfileSnapshots } from './profile-snapshot.diff';

const previous: ProfileSnapshot = {
  source: 'manual',
  capturedAt: '2026-08-20T12:00:00.000Z',
  completeness: UNREADABLE_PROFILE_COMPLETENESS,
  profile: {
    title: 'Frontend Developer',
    overview: 'I build web applications.',
    skills: ['React', 'TypeScript'],
    portfolio: [{ title: 'Dashboard', skills: ['React'] }],
    employment: [],
    education: [],
    certifications: [],
    languages: [],
  },
};

describe('diffProfileSnapshots', () => {
  it('detects every supported field-level change without AI', () => {
    const current: ProfileSnapshot = {
      ...previous,
      capturedAt: '2026-08-21T12:00:00.000Z',
      profile: {
        ...previous.profile,
        title: 'Senior React Developer',
        overview: 'I help SaaS teams ship reliable web applications.',
        skills: ['React', 'Next.js'],
        portfolio: [{ title: 'Marketplace', skills: ['Next.js'] }],
      },
    };

    expect(diffProfileSnapshots(previous, current)).toEqual({
      title: { status: 'changed' },
      overview: { status: 'updated' },
      portfolio: { status: 'changed', added: 1, removed: 1 },
      skills: {
        status: 'changed',
        added: ['Next.js'],
        removed: ['TypeScript'],
      },
    });
  });

  it('reports unchanged fields, including portfolio skill-order changes', () => {
    const sameSnapshot: ProfileSnapshot = {
      ...previous,
      capturedAt: '2026-08-21T12:00:00.000Z',
      profile: {
        ...previous.profile,
        portfolio: [{ title: 'Dashboard', skills: ['TypeScript', 'React'] }],
      },
    };
    const withBothPortfolioSkills: ProfileSnapshot = {
      ...previous,
      profile: {
        ...previous.profile,
        portfolio: [{ title: 'Dashboard', skills: ['React', 'TypeScript'] }],
      },
    };

    expect(diffProfileSnapshots(withBothPortfolioSkills, sameSnapshot)).toEqual(
      {
        title: { status: 'unchanged' },
        overview: { status: 'unchanged' },
        portfolio: { status: 'unchanged', added: 0, removed: 0 },
        skills: { status: 'unchanged', added: [], removed: [] },
      },
    );
  });
});
