import { describe, expect, it } from 'vitest';
import { AI_CAPABILITIES } from '../../capabilities';
import { capabilityFixtures } from './capability-fixtures';

describe('fake capability fixtures', () => {
  it.each(AI_CAPABILITIES)(
    '%s parses against its model-facing schema',
    (capability) => {
      expect(
        capabilityFixtures[capability].schema.safeParse(
          capabilityFixtures[capability].object,
        ),
      ).toMatchObject({ success: true });
    },
  );

  it.each(AI_CAPABILITIES)(
    '%s emits unconstrained numeric JSON schema',
    (capability) => {
      const jsonSchema = capabilityFixtures[capability].schema.toJSONSchema();
      assertNumbersAreUnconstrained(jsonSchema);
    },
  );

  it('parses every profile improver alternative against the suggestion schema', () => {
    for (const variant of capabilityFixtures.profileImprover.variants) {
      expect(
        capabilityFixtures.profileImprover.schema.safeParse(variant),
      ).toMatchObject({ success: true });
    }
  });
});

function assertNumbersAreUnconstrained(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNumbersAreUnconstrained(item);
    return;
  }
  if (typeof value !== 'object' || value === null) return;

  const schema = value as Record<string, unknown>;
  if (schema.type === 'number') {
    expect(schema).not.toHaveProperty('minimum');
    expect(schema).not.toHaveProperty('maximum');
    expect(schema).not.toHaveProperty('multipleOf');
  }
  expect(schema.type).not.toBe('integer');

  for (const nested of Object.values(schema))
    assertNumbersAreUnconstrained(nested);
}
