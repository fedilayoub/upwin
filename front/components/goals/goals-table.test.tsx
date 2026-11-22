import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GoalsTable } from '@/components/goals/goals-table';
import en from '@/i18n/dictionaries/en';
import type { GoalConfiguration } from '@/lib/api';

vi.mock('@/app/[lang]/(app)/actions', () => ({
  activateGoalAction: vi.fn(),
  createGoalAction: vi.fn(),
  deleteGoalAction: vi.fn(),
  updateGoalAction: vi.fn(),
}));

const goals: GoalConfiguration[] = [
  {
    id: 'goal-one',
    objective: 'higher-paying-projects',
    targetRole: 'Senior Frontend Developer',
    targetProjectTypes: ['SaaS applications', 'Design systems', 'AI products'],
    targetClients: ['SaaS companies'],
    preferredSkills: ['React', 'TypeScript'],
    targetRate: { min: 85, max: 120 },
    isActive: true,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-21T10:00:00.000Z',
  },
  {
    id: 'goal-two',
    objective: 'more-clients',
    targetRole: 'Product Designer',
    targetProjectTypes: ['Mobile apps'],
    targetClients: [],
    preferredSkills: ['Figma'],
    targetRate: null,
    isActive: false,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z',
  },
];

describe('GoalsTable', () => {
  it('renders saved goals in a semantic table with row-level actions', () => {
    const markup = renderToStaticMarkup(
      <GoalsTable copy={en.goals} goals={goals} locale="en" />,
    );

    expect(markup).toContain('<table');
    expect(markup).toContain(en.goals.columns.targetWork);
    expect(markup).toContain('Senior Frontend Developer');
    expect(markup).toContain('Product Designer');
    expect(markup).toContain('$85–$120');
    expect(markup).toContain(en.goals.activeBadge);
    expect(markup).toContain('data-active="true"');
    expect(markup).toContain(
      `${en.goals.columns.actions}: Senior Frontend Developer`,
    );
    expect(markup).toContain(
      `${en.goals.columns.actions}: Product Designer`,
    );
  });

  it('renders a composed empty state inside the table', () => {
    const markup = renderToStaticMarkup(
      <GoalsTable copy={en.goals} goals={[]} locale="en" />,
    );

    expect(markup).toContain('colSpan="6"');
    expect(markup).toContain(en.goals.createTitle);
    expect(markup).toContain(en.goals.noActive);
    expect(markup).toContain(en.goals.newGoal);
  });
});
