import { describe, expect, it } from 'vitest';
import { capabilityFixtures } from '../modes/fixtures/capability-fixtures';
import { profileEvaluationSchema } from './profile-evaluation.schema';

describe('profileEvaluationSchema', () => {
  it('contains judgments but no model-owned totals', () => {
    const schema = JSON.stringify(profileEvaluationSchema.toJSONSchema());
    expect(schema).not.toContain('winningScore');
    expect(schema).not.toContain('sectionScore');
  });

  it('emits unconstrained number schemas for model compatibility', () => {
    assertNumbersArePlain(profileEvaluationSchema.toJSONSchema());
  });

  it('rejects a response missing any required section', () => {
    const fixture = structuredClone(capabilityFixtures.profileAnalyzer.object);
    const response = {
      ...fixture,
      sections: fixture.sections.filter((section) => section.id !== 'title'),
    };

    expect(profileEvaluationSchema.safeParse(response).success).toBe(false);
  });

  it('rejects an unknown criterion name', () => {
    const fixture = structuredClone(capabilityFixtures.profileAnalyzer.object);
    const firstSection = fixture.sections[0];
    if (!firstSection)
      throw new Error('The test fixture must include a section.');
    const response = {
      ...fixture,
      sections: [
        {
          ...firstSection,
          criteria: firstSection.criteria.map((criterion, index) =>
            index === 0
              ? { ...criterion, name: 'inventedCriterion' }
              : criterion,
          ),
        },
        ...fixture.sections.slice(1),
      ],
    };

    expect(profileEvaluationSchema.safeParse(response).success).toBe(false);
  });

  it('rejects a present section with an empty criteria array', () => {
    const fixture = structuredClone(capabilityFixtures.profileAnalyzer.object);
    const response = {
      ...fixture,
      sections: fixture.sections.map((section) =>
        section.id === 'overview' ? { ...section, criteria: [] } : section,
      ),
    };

    expect(profileEvaluationSchema.safeParse(response).success).toBe(false);
  });
});

function assertNumbersArePlain(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNumbersArePlain(item);
    return;
  }
  if (typeof value !== 'object' || value === null) return;

  const schema = value as Record<string, unknown>;
  if (schema.type === 'number') {
    expect(Object.keys(schema).sort()).toEqual(['type']);
  }
  expect(schema.type).not.toBe('integer');

  for (const nested of Object.values(schema)) assertNumbersArePlain(nested);
}
