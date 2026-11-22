import { describe, expect, it } from 'vitest';
import { AiEvaluationError } from '../../ai/model-registry.service';
import type { ProfileEvaluation } from '../../ai/schemas/profile-evaluation.schema';
import {
  inspectProfile,
  type TargetJobProfile,
} from '../analysis/deterministic/profile-facts';
import { profileRubricV1 } from '../analysis/rubric/upwork-profile-v1';
import { PROFILE_SECTION_IDS } from '../profile-section';
import {
  UNREADABLE_PROFILE_COMPLETENESS,
  type ProfileSnapshot,
} from '../../profile-snapshots/profile-snapshot.schema';
import { InvalidAiCriterionScoreError, scoreProfile } from './profile-scoring';
import { getScoringWeights } from './weights/scoring-weights';

const target: TargetJobProfile = {
  role: 'Senior React Developer',
  projectTypes: ['SaaS dashboard'],
  clients: ['startups'],
  preferredSkills: ['TypeScript'],
};
const completeSnapshot: ProfileSnapshot = {
  source: 'manual',
  capturedAt: '2026-08-20T10:00:00.000Z',
  completeness: UNREADABLE_PROFILE_COMPLETENESS,
  profile: {
    title: 'Senior React Developer for SaaS startups',
    overview: 'I build TypeScript dashboard products.',
    skills: [
      'React',
      'TypeScript',
      'Next.js',
      'Testing',
      'Postgres',
      'Node.js',
    ],
    portfolio: [
      { title: 'SaaS dashboard', skills: ['React'] },
      { title: 'Admin app', skills: ['TypeScript'] },
    ],
    employment: [{ title: 'Senior React Developer' }],
    education: [{ degree: 'Computer Science' }],
    certifications: [{ name: 'Cloud Developer' }],
    languages: [{ name: 'English' }],
  },
};

function evaluation(score = 80): Pick<ProfileEvaluation, 'sections'> {
  return {
    sections: PROFILE_SECTION_IDS.map((sectionId) => ({
      id: sectionId,
      criteria: profileRubricV1[sectionId].criteria
        .filter((criterion) => criterion.source === 'ai')
        .map((criterion) => ({
          name: criterion.id,
          score,
          reasoning: 'Fixed reasoning.',
          evidence: [`Evidence for ${criterion.id}.`],
        })),
      strengths: [],
      issues: [],
    })),
  };
}

describe('scoreProfile', () => {
  it('computes exact section scores and a backend-owned Winning Score', () => {
    const score = scoreProfile(
      evaluation(),
      inspectProfile(completeSnapshot, target),
      getScoringWeights('first-client'),
    );

    expect({
      sectionScores: score.sectionScores.map(({ id, score: sectionScore }) => ({
        id,
        score: sectionScore,
      })),
      winningScore: score.winningScore,
    }).toEqual({
      sectionScores: [
        { id: 'positioning', score: 83 },
        { id: 'overview', score: 85 },
        { id: 'title', score: 83 },
        { id: 'skills', score: 84 },
        { id: 'portfolio', score: 68 },
        { id: 'experience', score: 84 },
        { id: 'trust', score: 86 },
        { id: 'goalAlignment', score: 85 },
      ],
      winningScore: 81,
    });
    expect(score.sectionScores[0]?.criteria[0]).toEqual({
      id: 'positioningClarity',
      label: 'Positioning clarity',
      evidence: ['Evidence for positioningClarity.'],
    });
  });

  it('produces an identical Winning Score for identical criteria input', () => {
    const input = evaluation(73);
    const facts = inspectProfile(completeSnapshot, target);
    const weights = getScoringWeights('higher-paying-projects');

    expect(scoreProfile(input, facts, weights)).toEqual(
      scoreProfile(input, facts, weights),
    );
  });

  it('does not change any Winning Score when completeness facts change', () => {
    const unreadableScore = scoreProfile(
      evaluation(),
      inspectProfile(completeSnapshot, target),
      getScoringWeights('first-client'),
    );
    const missingCompletenessScore = scoreProfile(
      evaluation(),
      inspectProfile(
        {
          ...completeSnapshot,
          completeness: {
            hasIntroVideo: false,
            hasProfilePhoto: false,
            availabilityBadge: false,
            idVerified: false,
            verifications: [],
            licenses: 0,
            linkedAccounts: [],
          },
        },
        target,
      ),
      getScoringWeights('first-client'),
    );

    expect(missingCompletenessScore).toEqual(unreadableScore);
    expect(missingCompletenessScore.winningScore).toBe(81);
  });

  it('moves the portfolio score only with project count and title alignment', () => {
    const oneProject = {
      ...completeSnapshot,
      profile: {
        ...completeSnapshot.profile,
        portfolio: completeSnapshot.profile.portfolio.slice(0, 1),
      },
    };
    const threeProjects = {
      ...completeSnapshot,
      profile: {
        ...completeSnapshot.profile,
        portfolio: [
          ...completeSnapshot.profile.portfolio,
          { title: 'React SaaS client portal', skills: [] },
        ],
      },
    };
    const alignedEvaluation = evaluation(50);
    const portfolioSection = alignedEvaluation.sections.find(
      (section) => section.id === 'portfolio',
    );
    if (!portfolioSection) throw new Error('Missing portfolio fixture.');
    portfolioSection.criteria[0] = {
      name: 'portfolioAlignment',
      score: 100,
      reasoning: 'Every supplied title points at the target work.',
      evidence: ['“React SaaS client portal” names the target project type.'],
    };

    const oneProjectScore = scoreProfile(
      evaluation(50),
      inspectProfile(oneProject, target),
      getScoringWeights('first-client'),
    ).sectionScores.find((section) => section.id === 'portfolio');
    const threeProjectScore = scoreProfile(
      evaluation(50),
      inspectProfile(threeProjects, target),
      getScoringWeights('first-client'),
    ).sectionScores.find((section) => section.id === 'portfolio');
    const alignedThreeProjectScore = scoreProfile(
      alignedEvaluation,
      inspectProfile(threeProjects, target),
      getScoringWeights('first-client'),
    ).sectionScores.find((section) => section.id === 'portfolio');

    expect(oneProjectScore).toMatchObject({
      score: 40,
      criteria: [expect.objectContaining({ id: 'portfolioAlignment' })],
    });
    expect(threeProjectScore?.score).toBe(60);
    expect(alignedThreeProjectScore?.score).toBe(90);
    expect(JSON.stringify(alignedThreeProjectScore)).not.toMatch(
      /portfolioQuality|portfolioProof|description/iu,
    );
  });

  it('throws instead of fabricating a score for an omitted model section', () => {
    const sparseInput: Pick<ProfileEvaluation, 'sections'> = {
      sections: evaluation().sections.filter(
        (section) => section.id !== 'title',
      ),
    };

    expect(() =>
      scoreProfile(
        sparseInput,
        inspectProfile(completeSnapshot, target),
        getScoringWeights('first-client'),
      ),
    ).toThrow(AiEvaluationError);
  });

  it('throws instead of fabricating a score for a missing AI criterion', () => {
    const completeInput = evaluation();
    const sparseInput: Pick<ProfileEvaluation, 'sections'> = {
      sections: completeInput.sections.map((section) =>
        section.id === 'title'
          ? {
              id: 'title',
              criteria: [
                {
                  name: 'titleSearchability',
                  score: 80,
                  reasoning: 'Explicit sparse fixture.',
                  evidence: ['The title includes “React”.'],
                },
                {
                  name: 'titleTargetAlignment',
                  score: 80,
                  reasoning: 'Explicit sparse fixture.',
                  evidence: ['The target role is “React Developer”.'],
                },
              ],
              strengths: [],
              issues: [],
            }
          : section,
      ),
    };

    expect(() =>
      scoreProfile(
        sparseInput,
        inspectProfile(completeSnapshot, target),
        getScoringWeights('first-client'),
      ),
    ).toThrow(AiEvaluationError);
  });

  it('scores every non-applicable section as zero for an empty profile', () => {
    const emptySnapshot: ProfileSnapshot = {
      ...completeSnapshot,
      profile: {
        skills: [],
        portfolio: [],
        employment: [],
        education: [],
        certifications: [],
        languages: [],
      },
    };

    const score = scoreProfile(
      evaluation(100),
      inspectProfile(emptySnapshot, target),
      getScoringWeights('first-client'),
    );

    expect({
      sectionScores: score.sectionScores.map(({ id, score: sectionScore }) => ({
        id,
        score: sectionScore,
      })),
      winningScore: score.winningScore,
    }).toEqual({
      sectionScores: PROFILE_SECTION_IDS.map((id) => ({ id, score: 0 })),
      winningScore: 0,
    });
  });

  it.each([-1, 100.5, 101])(
    'rejects an out-of-domain AI score of %s',
    (invalidScore) => {
      expect(() =>
        scoreProfile(
          evaluation(invalidScore),
          inspectProfile(completeSnapshot, target),
          getScoringWeights('first-client'),
        ),
      ).toThrow(InvalidAiCriterionScoreError);
    },
  );
});
