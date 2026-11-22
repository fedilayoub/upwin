import { describe, expect, it } from 'vitest';
import { DEFAULT_ANALYZER_TEMPLATE } from './profile-analyzer/default-analyzer-template';
import {
  AI_PROFILE_CRITERION_IDS,
  analyzerTemplateContentSchema,
} from './prompt-template.schema';

describe('analyzerTemplateContentSchema', () => {
  it('accepts the code default and rejects a missing or unknown criterion', () => {
    expect(
      analyzerTemplateContentSchema.safeParse(DEFAULT_ANALYZER_TEMPLATE).success,
    ).toBe(true);

    const missing = cloneDefault();
    delete missing.criterionAnchors[AI_PROFILE_CRITERION_IDS[0] as string];
    expect(analyzerTemplateContentSchema.safeParse(missing).success).toBe(false);

    const unknown = cloneDefault();
    unknown.criterionAnchors.unknownCriterion = {
      0: 'zero',
      25: 'twenty five',
      50: 'fifty',
      75: 'seventy five',
      100: 'one hundred',
    };
    expect(analyzerTemplateContentSchema.safeParse(unknown).success).toBe(false);
  });

  it('rejects a missing anchor score and a missing objective', () => {
    const missingAnchor = cloneDefault();
    const criterionId = AI_PROFILE_CRITERION_IDS[0] as string;
    delete (missingAnchor.criterionAnchors[criterionId] as Record<
      string,
      string
    >)['25'];
    expect(
      analyzerTemplateContentSchema.safeParse(missingAnchor).success,
    ).toBe(false);

    const missingObjective = cloneDefault();
    delete (missingObjective.goalStrategies as Partial<
      typeof missingObjective.goalStrategies
    >)['first-client'];
    expect(
      analyzerTemplateContentSchema.safeParse(missingObjective).success,
    ).toBe(false);
  });

  it('rejects text over each block limit', () => {
    const persona = cloneDefault();
    persona.systemPersona = 'a'.repeat(2_001);
    expect(analyzerTemplateContentSchema.safeParse(persona).success).toBe(false);

    const policy = cloneDefault();
    policy.policy = 'a'.repeat(4_001);
    expect(analyzerTemplateContentSchema.safeParse(policy).success).toBe(false);

    const strategy = cloneDefault();
    strategy.goalStrategies['first-client'] = 'a'.repeat(601);
    expect(analyzerTemplateContentSchema.safeParse(strategy).success).toBe(false);

    const anchor = cloneDefault();
    const criterionId = AI_PROFILE_CRITERION_IDS[0] as string;
    const anchors = anchor.criterionAnchors[criterionId];
    if (!anchors) throw new Error('Default criterion anchors are incomplete.');
    anchors[0] = 'a'.repeat(401);
    expect(analyzerTemplateContentSchema.safeParse(anchor).success).toBe(false);
  });

  it.each(['<', '>', '</profile_snapshot>'])(
    'rejects %s in every editable block category',
    (hostileText) => {
      const persona = cloneDefault();
      persona.systemPersona = hostileText;
      expect(analyzerTemplateContentSchema.safeParse(persona).success).toBe(
        false,
      );

      const policy = cloneDefault();
      policy.policy = hostileText;
      expect(analyzerTemplateContentSchema.safeParse(policy).success).toBe(
        false,
      );

      const strategy = cloneDefault();
      strategy.goalStrategies['first-client'] = hostileText;
      expect(analyzerTemplateContentSchema.safeParse(strategy).success).toBe(
        false,
      );

      const anchor = cloneDefault();
      const criterionId = AI_PROFILE_CRITERION_IDS[0] as string;
      const anchors = anchor.criterionAnchors[criterionId];
      if (!anchors) throw new Error('Default criterion anchors are incomplete.');
      anchors[0] = hostileText;
      expect(analyzerTemplateContentSchema.safeParse(anchor).success).toBe(
        false,
      );
    },
  );
});

function cloneDefault() {
  return structuredClone(DEFAULT_ANALYZER_TEMPLATE);
}
