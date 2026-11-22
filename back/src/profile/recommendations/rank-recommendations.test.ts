import { describe, expect, it } from 'vitest';
import type { ProfileSectionId } from '../profile-section';
import type { SectionScore } from '../scoring/profile-scoring';
import { getScoringWeights } from '../scoring/weights/scoring-weights';
import type { CompletenessFillRecommendation } from './completeness-recommendations';
import {
  InvalidRecommendationEvidenceError,
  rankRecommendations,
  topRecommendations,
} from './rank-recommendations';

const emptyCounts = {
  skills: 0,
  portfolio: 0,
  employment: 0,
  education: 0,
  certifications: 0,
  languages: 0,
};

describe('rankRecommendations', () => {
  it('derives varied impact and rank from goal weight times score gap', () => {
    const ranked = rankRecommendations(
      [
        priority('title', 'Title evidence.'),
        priority('overview', 'Overview evidence.'),
        priority('portfolio', 'Portfolio evidence.'),
        priority('skills', 'Skills evidence.'),
      ],
      [
        sectionScore('title', 10, 'Title evidence.'),
        sectionScore('overview', 70, 'Overview evidence.'),
        sectionScore('portfolio', 20, 'Portfolio evidence.'),
        sectionScore('skills', 50, 'Skills evidence.'),
      ],
      getScoringWeights('first-client'),
      { counts: emptyCounts },
    );

    expect(ranked.map(({ section }) => section)).toEqual([
      'portfolio',
      'skills',
      'overview',
      'title',
    ]);
    expect(ranked.map(({ impact }) => impact)).toEqual([
      'high',
      'medium',
      'medium',
      'low',
    ]);
    expect(ranked.map(({ rank }) => rank)).toEqual([1, 2, 3, 4]);
    expect(ranked[0]?.estimatedMinutes).toBe(20);
    expect(topRecommendations(ranked)).toHaveLength(3);
  });

  it('merges priorities that resolve to the same field and keeps both evidence-backed rationales', () => {
    const ranked = rankRecommendations(
      [
        {
          section: 'positioning',
          recommendation: 'Use a specific target-role title.',
          reason: 'Positioning evidence. The positioning is broad.',
          evidence: ['Positioning evidence.'],
        },
        {
          section: 'title',
          recommendation: 'Name the SaaS specialty.',
          reason: 'Title evidence. The title omits the target niche.',
          evidence: ['Title evidence.'],
        },
      ],
      [
        sectionScore('positioning', 20, 'Positioning evidence.'),
        sectionScore('title', 30, 'Title evidence.'),
      ],
      getScoringWeights('more-responses'),
      { counts: emptyCounts },
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({
      section: 'positioning',
      rank: 1,
      impact: 'high',
      estimatedMinutes: 5,
      evidence: ['Positioning evidence.', 'Title evidence.'],
    });
    expect(ranked[0]?.recommendation).toContain('specific target-role title');
    expect(ranked[0]?.recommendation).toContain('SaaS specialty');
    expect(ranked[0]?.reason).toContain('positioning is broad');
    expect(ranked[0]?.reason).toContain('title omits the target niche');
  });

  it('ranks completeness fills by deterministic opportunity instead of input order', () => {
    const fills: CompletenessFillRecommendation[] = [
      completenessFill('eligibleVerification'),
      completenessFill('introVideo'),
    ];
    const ranked = rankRecommendations(
      [],
      [
        sectionScore('positioning', 50, 'Positioning evidence.'),
        sectionScore('trust', 50, 'Trust evidence.'),
      ],
      getScoringWeights('first-client'),
      { counts: emptyCounts },
      fills,
    );

    expect(
      ranked.map((recommendation) =>
        'signal' in recommendation ? recommendation.signal : null,
      ),
    ).toEqual(['introVideo', 'eligibleVerification']);
    expect(ranked.map(({ impact }) => impact)).toEqual(['medium', 'medium']);
  });

  it('rejects a priority that cites no evidence at all', () => {
    expect(() =>
      rankRecommendations(
        [
          {
            section: 'overview',
            recommendation: 'Lead with the client problem.',
            reason: 'Clear client benefits improve trust.',
            evidence: [],
          },
        ],
        [sectionScore('overview', 40, 'Captured overview opening.')],
        getScoringWeights('first-client'),
        { counts: emptyCounts },
      ),
    ).toThrow(InvalidRecommendationEvidenceError);
  });

  // Replaces a test that asserted a throw here. Set-equality between the
  // priority's citations and the section's criterion evidence is unachievable in
  // practice — the model labels its citations rather than copying them — so the
  // guarantee is enforced by adding the scored section's own evidence instead.
  it('grounds a priority by adding the evidence returned for its own section', () => {
    const ranked = rankRecommendations(
      [
        {
          section: 'title',
          recommendation: 'Name the target client type.',
          reason: 'The title omits the client type.',
          evidence: ["Title: 'Frontend developer' names no client type."],
        },
      ],
      [
        sectionScore('title', 40, 'Captured title text.'),
        sectionScore('overview', 40, 'Captured overview opening.'),
      ],
      getScoringWeights('first-client'),
      { counts: emptyCounts },
    );

    expect(ranked[0]?.evidence).toEqual([
      "Title: 'Frontend developer' names no client type.",
      'Captured title text.',
    ]);
    // Never another section's material.
    expect(ranked[0]?.evidence).not.toContain('Captured overview opening.');
  });

  // Regression: the reason describes the problem and the evidence supplies the
  // quote, which is how a real model writes. Requiring the quote to appear
  // verbatim inside the sentence rejected correct output and made every live
  // analysis fail with AI_EVALUATION_FAILED.
  it('accepts a reason that describes the problem without quoting its evidence verbatim', () => {
    const ranked = rankRecommendations(
      [
        {
          section: 'title',
          recommendation: 'Name the target client type.',
          reason:
            'The title names the target role and specialties but not the client types served.',
          evidence: ['Frontend developer | React, Vue.js, Angular, TypeScript'],
        },
      ],
      [
        sectionScore(
          'title',
          40,
          'Frontend developer | React, Vue.js, Angular, TypeScript',
        ),
      ],
      getScoringWeights('first-client'),
      { counts: emptyCounts },
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.section).toBe('title');
  });
});

function priority(section: ProfileSectionId, evidence: string) {
  return {
    section,
    recommendation: `${section} recommendation`,
    reason: `${evidence} Specific reason for ${section}.`,
    evidence: [evidence],
  };
}

function sectionScore(
  id: ProfileSectionId,
  score: number,
  evidence: string,
): SectionScore {
  return {
    id,
    score,
    criteria: [
      {
        id: `${id}Criterion`,
        label: `${id} criterion`,
        evidence: [evidence],
      },
    ],
  };
}

function completenessFill(
  signal: 'introVideo' | 'eligibleVerification',
): CompletenessFillRecommendation {
  const evidence = `Evidence for ${signal}.`;
  return {
    signal,
    section: signal === 'introVideo' ? 'positioning' : 'trust',
    estimatedMinutes: 5,
    recommendation: `Recommendation for ${signal}`,
    reason: `${evidence} Reason for ${signal}`,
    evidence: [evidence],
    kind: 'fill',
    field: null,
    itemIndex: null,
    guidance: `Guidance for ${signal}`,
    items: [`Action for ${signal}`],
  };
}
