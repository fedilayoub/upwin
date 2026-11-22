import type { FreelancerPortfolio } from '../../freelancer-context/freelancer-context.schema';
import type { ProfileSnapshot } from '../../profile-snapshots/profile-snapshot.schema';
import {
  containsToken,
  extractTargetKeywords,
  normalize,
  type TargetJobProfile,
} from '../analysis/deterministic/profile-facts';

type FreelancerPortfolioProject = FreelancerPortfolio[number];

export type RankedMissingPortfolioProject = FreelancerPortfolioProject & {
  title: string;
};

interface RankedCandidate {
  project: RankedMissingPortfolioProject;
  originalIndex: number;
  targetKeywordMatches: number;
}

const MAX_RECOMMENDED_PROJECTS = 3;

export function rankMissingPortfolioProjects(
  publishedPortfolio: ProfileSnapshot['profile']['portfolio'],
  cvPortfolio: FreelancerPortfolio,
  targetJobProfile: TargetJobProfile,
): RankedMissingPortfolioProject[] {
  const publishedTitles = new Set(
    publishedPortfolio.flatMap((project) =>
      project.title === undefined ? [] : [normalize(project.title)],
    ),
  );
  const targetKeywords = extractTargetKeywords(targetJobProfile);

  return cvPortfolio
    .flatMap<RankedCandidate>((project, originalIndex) => {
      if (project.title === undefined) return [];

      const normalizedTitle = normalize(project.title);
      if (publishedTitles.has(normalizedTitle)) return [];

      const searchableProject = normalize(
        [project.title, ...project.skills].join(' '),
      );
      return [
        {
          project: { ...project, title: project.title },
          originalIndex,
          targetKeywordMatches: targetKeywords.filter((keyword) =>
            containsToken(searchableProject, keyword),
          ).length,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.targetKeywordMatches - left.targetKeywordMatches ||
        left.originalIndex - right.originalIndex,
    )
    .slice(0, MAX_RECOMMENDED_PROJECTS)
    .map(({ project }) => project);
}
