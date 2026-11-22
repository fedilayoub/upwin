import { describe, expect, it } from 'vitest';
import { PROFILE_SECTION_IDS } from '../../profile-section';
import {
  profileRubricV1,
  rubricVersion,
  RUBRIC_ANCHOR_SCORES,
} from './upwork-profile-v1';

describe('profileRubricV1', () => {
  it('uses the portfolio-title rubric version', () => {
    expect(rubricVersion).toBe('upwork-profile-v3');
  });

  it('anchors every AI criterion at 0, 25, 50, 75, and 100', () => {
    for (const sectionId of PROFILE_SECTION_IDS) {
      const rubric = profileRubricV1[sectionId];
      expect(
        rubric.criteria.reduce((sum, criterion) => sum + criterion.weight, 0),
      ).toBeCloseTo(1);

      for (const criterion of rubric.criteria) {
        if (criterion.source !== 'ai') continue;
        expect(
          Object.keys(criterion.anchors)
            .map(Number)
            .sort((a, b) => a - b),
        ).toEqual(RUBRIC_ANCHOR_SCORES);
        for (const score of RUBRIC_ANCHOR_SCORES) {
          expect(criterion.anchors[score].length).toBeGreaterThan(10);
        }
      }
    }
  });

  it('contains no unsupported numeric performance claim', () => {
    const rubricText = JSON.stringify(profileRubricV1);
    expect(rubricText).not.toMatch(
      /\b\d+(?:\.\d+)?\s*(?:%|x|×|times|fold)\b/iu,
    );
  });

  it('scores portfolio only from project presence and published titles', () => {
    expect(
      profileRubricV1.portfolio.criteria.map((criterion) => ({
        id: criterion.id,
        source: criterion.source,
        weight: criterion.weight,
      })),
    ).toEqual([
      { id: 'portfolioDepth', source: 'deterministic', weight: 0.4 },
      { id: 'portfolioAlignment', source: 'ai', weight: 0.6 },
    ]);
    expect(JSON.stringify(profileRubricV1.portfolio)).not.toMatch(
      /description|prose|case-study|case study/iu,
    );
  });
});
