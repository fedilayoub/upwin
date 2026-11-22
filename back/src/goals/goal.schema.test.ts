import { describe, expect, it } from 'vitest';
import { createGoalSchema, updateGoalSchema } from './goal.schema';

describe('goal schemas', () => {
  it('does not accept a body-selected user id', () => {
    expect(
      createGoalSchema.safeParse({
        userId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b',
        objective: 'more-clients',
        targetRole: 'Frontend Engineer',
        targetProjectTypes: ['SaaS'],
      }),
    ).toMatchObject({ success: false });
  });

  it('permits activation but not direct deactivation', () => {
    expect(updateGoalSchema.safeParse({ isActive: true })).toMatchObject({
      success: true,
    });
    expect(updateGoalSchema.safeParse({ isActive: false })).toMatchObject({
      success: false,
    });
  });
});
