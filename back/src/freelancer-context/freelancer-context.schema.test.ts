import { describe, expect, it } from 'vitest';
import { freelancerContextFieldsSchema } from './freelancer-context.schema';

describe('freelancerContextFieldsSchema', () => {
  it('does not accept a body-selected user or trust flag', () => {
    expect(
      freelancerContextFieldsSchema.safeParse({
        userId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b',
        confirmed: true,
        experience: { roles: [] },
        skills: ['React'],
        portfolio: [],
        preferences: {},
        positioning: {},
      }),
    ).toMatchObject({ success: false });
  });
});
