import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GoalForm } from '@/components/goals/goal-form';
import en from '@/i18n/dictionaries/en';
import type { GoalConfiguration } from '@/lib/api';

vi.mock('@/app/[lang]/(app)/actions', () => ({
  createGoalAction: vi.fn(),
  updateGoalAction: vi.fn(),
}));

const goal: GoalConfiguration = {
  id: 'goal-one',
  objective: 'higher-paying-projects',
  targetRole: 'Senior Frontend Developer',
  targetProjectTypes: ['SaaS applications', 'Design systems'],
  targetClients: ['Series A, B2B SaaS'],
  preferredSkills: ['React'],
  targetRate: { min: 85, max: 120 },
  isActive: true,
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-21T10:00:00.000Z',
};

describe('GoalForm', () => {
  it('posts every selected list value as its own field so commas survive', () => {
    const markup = renderToStaticMarkup(
      <GoalForm copy={en.goals} goal={goal} locale="en" />,
    );

    expect(markup).toContain(
      '<input type="hidden" name="targetProjectTypes" value="SaaS applications"/>',
    );
    expect(markup).toContain(
      '<input type="hidden" name="targetProjectTypes" value="Design systems"/>',
    );
    expect(markup).toContain(
      '<input type="hidden" name="targetClients" value="Series A, B2B SaaS"/>',
    );
    expect(markup).toContain(
      '<input type="hidden" name="preferredSkills" value="React"/>',
    );
    expect(markup).not.toContain('<textarea');
  });

  it('renders the stored rate as an enabled range with both bounds submitted', () => {
    const markup = renderToStaticMarkup(
      <GoalForm copy={en.goals} goal={goal} locale="en" />,
    );

    expect(markup).toContain('<input type="hidden" name="targetRateMin" value="85"/>');
    expect(markup).toContain('<input type="hidden" name="targetRateMax" value="120"/>');
    expect(markup).toContain('$85 – $120');
    expect(markup).toContain(en.goals.fields.targetRateEnabled);
  });

  it('leaves the rate unset on a new goal so the payload stays null', () => {
    const markup = renderToStaticMarkup(
      <GoalForm copy={en.goals} locale="en" />,
    );

    expect(markup).not.toContain('name="targetRateMin"');
    expect(markup).not.toContain('name="targetRateMax"');
    expect(markup).toContain(en.goals.fields.targetRateOff);
    expect(markup).toContain(en.goals.suggestions.targetRole[0]);
  });
});
