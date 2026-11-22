import { describe, expect, it } from 'vitest';
import type { FreelancerPortfolio } from '../../freelancer-context/freelancer-context.schema';
import type { ProfileSnapshot } from '../../profile-snapshots/profile-snapshot.schema';
import type { TargetJobProfile } from '../analysis/deterministic/profile-facts';
import { rankMissingPortfolioProjects } from './portfolio-gap';

const target: TargetJobProfile = {
  role: 'Senior React Developer',
  projectTypes: ['SaaS dashboard'],
  clients: ['startups'],
  preferredSkills: ['React', 'TypeScript'],
};

const cvProjects: FreelancerPortfolio = [
  { title: 'Marketing website', skills: ['CSS'] },
  {
    title: 'React SaaS dashboard',
    skills: ['React', 'TypeScript'],
  },
  { title: 'TypeScript component library', skills: ['TypeScript'] },
];

describe('rankMissingPortfolioProjects', () => {
  it('returns missing CV projects ranked by target fit', () => {
    expect(rankMissingPortfolioProjects([], cvProjects, target)).toEqual([
      cvProjects[1],
      cvProjects[2],
      cvProjects[0],
    ]);
  });

  it('removes published projects and preserves ranking among the gap', () => {
    const published: ProfileSnapshot['profile']['portfolio'] = [
      { title: 'Marketing website', skills: [] },
    ];

    expect(rankMissingPortfolioProjects(published, cvProjects, target)).toEqual(
      [cvProjects[1], cvProjects[2]],
    );
  });

  it('returns an empty gap when the CV contains no projects', () => {
    expect(rankMissingPortfolioProjects([], [], target)).toEqual([]);
  });

  it('matches titles without regard to case or whitespace', () => {
    const published: ProfileSnapshot['profile']['portfolio'] = [
      { title: '  REACT   SaaS\nDashboard ', skills: [] },
    ];

    expect(
      rankMissingPortfolioProjects(published, [cvProjects[1]!], target),
    ).toEqual([]);
  });

  it('caps the ranked gap at three projects', () => {
    const projects: FreelancerPortfolio = [
      ...cvProjects,
      { title: 'Unrelated fourth project', skills: [] },
    ];

    expect(rankMissingPortfolioProjects([], projects, target)).toHaveLength(3);
  });
});
