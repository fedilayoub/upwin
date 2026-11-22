import { describe, expect, it } from 'vitest';
import { validateGoalInput, type RawGoalInput } from '@/lib/goal-validation';

const validGoal: RawGoalInput = {
  objective: 'more-clients',
  targetRole: 'Senior Frontend Engineer',
  targetProjectTypes: ['SaaS dashboards', 'Design systems'],
  targetClients: ['Startups', 'Agencies'],
  preferredSkills: ['React', 'TypeScript'],
  targetRateMin: '75',
  targetRateMax: '125',
};

describe('goal form validation', () => {
  it('normalizes the form into the real API payload', () => {
    expect(validateGoalInput(validGoal)).toEqual({
      success: true,
      data: {
        objective: 'more-clients',
        targetRole: 'Senior Frontend Engineer',
        targetProjectTypes: ['SaaS dashboards', 'Design systems'],
        targetClients: ['Startups', 'Agencies'],
        preferredSkills: ['React', 'TypeScript'],
        targetRate: { min: 75, max: 125 },
      },
    });
  });

  it('requires a target role and at least one project type', () => {
    expect(
      validateGoalInput({
        ...validGoal,
        targetRole: ' ',
        targetProjectTypes: [],
      }),
    ).toMatchObject({
      success: false,
      errors: { targetProjectTypes: 'required', targetRole: 'required' },
    });
  });

  it('keeps a comma inside a single chip and drops duplicates', () => {
    expect(
      validateGoalInput({
        ...validGoal,
        targetClients: ['Series A, B2B SaaS', ' Agencies ', 'Agencies'],
      }),
    ).toMatchObject({
      success: true,
      data: { targetClients: ['Series A, B2B SaaS', 'Agencies'] },
    });
  });

  it('still splits a single pasted blob into separate items', () => {
    expect(
      validateGoalInput({
        ...validGoal,
        preferredSkills: ['React, TypeScript\nNode.js'],
      }),
    ).toMatchObject({
      success: true,
      data: { preferredSkills: ['React', 'TypeScript', 'Node.js'] },
    });
  });

  it('rejects a minimum rate above the maximum', () => {
    expect(
      validateGoalInput({
        ...validGoal,
        targetRateMin: '200',
        targetRateMax: '100',
      }),
    ).toMatchObject({
      success: false,
      errors: { targetRateMax: 'rateOrder' },
    });
  });
});
