import { describe, expect, it } from 'vitest';
import type { FreelancerContextFields } from '@/lib/api';
import {
  canConfirmFreelancerContext,
  validateFreelancerContextInput,
} from '@/lib/context-validation';

const emptyDraft: FreelancerContextFields = {
  experience: { roles: [] },
  skills: [],
  portfolio: [],
  preferences: {},
  positioning: {},
};

describe('CV review trust validation', () => {
  it('does not allow the review screen to confirm an empty draft', () => {
    expect(canConfirmFreelancerContext(emptyDraft)).toBe(false);
  });

  it('allows confirmation as soon as the draft contains meaningful context', () => {
    expect(
      canConfirmFreelancerContext({
        ...emptyDraft,
        skills: ['TypeScript'],
      }),
    ).toBe(true);
  });
});

describe('manual context validation', () => {
  const emptyInput = {
    experienceYears: '',
    roles: [],
    skills: [],
    portfolio: [],
    targetRole: '',
    targetClients: [],
    targetIndustries: [],
    targetRate: '',
    tone: '',
    services: [],
  };

  it('rejects an empty manual submission before it reaches the API', () => {
    expect(validateFreelancerContextInput(emptyInput)).toMatchObject({
      success: false,
      errors: { form: 'required' },
    });
  });

  it('drops role and project rows the freelancer added but never filled in', () => {
    expect(
      validateFreelancerContextInput({
        ...emptyInput,
        roles: [
          { title: 'Frontend Lead', company: 'Acme', period: '2022–2025', description: '' },
          { title: '', company: '', period: '', description: '' },
        ],
        portfolio: [{ title: '', description: '', url: '', skills: [] }],
      }),
    ).toEqual({
      success: true,
      data: {
        experience: {
          roles: [{ title: 'Frontend Lead', company: 'Acme', period: '2022–2025' }],
        },
        skills: [],
        portfolio: [],
        preferences: {},
        positioning: {},
      },
    });
  });

  it('keeps a comma inside a chip instead of splitting it', () => {
    const result = validateFreelancerContextInput({
      ...emptyInput,
      skills: ['React', 'Design systems, at scale'],
    });

    expect(result).toMatchObject({
      success: true,
      data: { skills: ['React', 'Design systems, at scale'] },
    });
  });

  it('rejects a project link that is not an HTTP URL', () => {
    expect(
      validateFreelancerContextInput({
        ...emptyInput,
        portfolio: [
          { title: 'Dashboard', description: '', url: 'not a url', skills: ['React'] },
        ],
      }),
    ).toMatchObject({ success: false, errors: { portfolio: 'invalidUrl' } });
  });
});
