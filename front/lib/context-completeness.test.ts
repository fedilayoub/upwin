import { describe, expect, it } from 'vitest';
import type { FreelancerContextFields } from '@/lib/api';
import {
  CONTEXT_SLOTS,
  contextSlotFilled,
  freelancerContextCompleteness,
} from '@/lib/context-completeness';

const EMPTY: FreelancerContextFields = {
  experience: { roles: [] },
  skills: [],
  portfolio: [],
  preferences: {},
  positioning: {},
};

const FULL: FreelancerContextFields = {
  experience: { years: 6, roles: [{ title: 'Frontend Lead' }] },
  skills: ['React'],
  portfolio: [{ skills: ['React'], title: 'Dashboard' }],
  preferences: { services: ['Frontend development'], tone: 'Clear' },
  positioning: {
    targetClients: ['Startups'],
    targetIndustries: ['SaaS'],
    targetRate: 85,
    targetRole: 'Senior Frontend Developer',
  },
};

describe('freelancerContextCompleteness', () => {
  it('reports nothing filled for an empty context', () => {
    const result = freelancerContextCompleteness(EMPTY);

    expect(result.filled).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.total).toBe(CONTEXT_SLOTS.length);
    expect(result.missing).toEqual([...CONTEXT_SLOTS]);
  });

  it('reports everything filled for a complete context', () => {
    const result = freelancerContextCompleteness(FULL);

    expect(result.filled).toBe(CONTEXT_SLOTS.length);
    expect(result.percent).toBe(100);
    expect(result.missing).toEqual([]);
  });

  it('lists only the empty slots, in declaration order', () => {
    const result = freelancerContextCompleteness({
      ...FULL,
      portfolio: [],
      preferences: { services: [] },
    });

    expect(result.missing).toEqual(['portfolio', 'tone', 'services']);
    expect(result.filled).toBe(CONTEXT_SLOTS.length - 3);
    expect(result.percent).toBe(70);
  });

  it('treats blank strings and empty lists as unfilled', () => {
    const fields: FreelancerContextFields = {
      ...EMPTY,
      preferences: { services: [], tone: '' },
      positioning: { targetClients: [], targetRole: '' },
    };

    expect(contextSlotFilled(fields, 'tone')).toBe(false);
    expect(contextSlotFilled(fields, 'targetRole')).toBe(false);
    expect(contextSlotFilled(fields, 'services')).toBe(false);
    expect(contextSlotFilled(fields, 'targetClients')).toBe(false);
  });

  it('counts a zero target rate as provided', () => {
    const fields: FreelancerContextFields = {
      ...EMPTY,
      positioning: { targetRate: 0 },
    };

    expect(contextSlotFilled(fields, 'targetRate')).toBe(true);
    expect(freelancerContextCompleteness(fields).filled).toBe(1);
  });
});
