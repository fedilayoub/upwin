import { describe, expect, it } from 'vitest';
import {
  attachPreviousOutcomes,
  mergePreviousPriorityOutcomes,
} from './previous-priority-outcomes';
import type { RankedRecommendation } from './rank-recommendations';
import type { PreviousPriority } from './verify-previous-priorities';

const refs = [
  { ref: 1, recommendationId: 'rec-1' },
  { ref: 2, recommendationId: 'rec-2' },
];

const counts = {
  skills: 4,
  portfolio: 2,
  employment: 1,
  education: 0,
  certifications: 0,
  languages: 1,
};

function previousPriority(
  id: string,
  overrides: Partial<PreviousPriority> = {},
): PreviousPriority {
  return {
    id,
    section: 'overview',
    signal: null,
    recommendation: 'Rewrite the opening.',
    reason: 'Because.',
    ...overrides,
  };
}

function ranked(section: RankedRecommendation['section']): RankedRecommendation {
  return {
    section,
    recommendation: 'Rewrite the opening.',
    reason: 'Because.',
    evidence: ['something'],
    impact: 'high',
    rank: 1,
    estimatedMinutes: 10,
  };
}

describe('mergePreviousPriorityOutcomes', () => {
  it('keeps the deterministic verdict when the model disagrees', () => {
    const merged = mergePreviousPriorityOutcomes(
      new Map([['rec-1', { status: 'not-implemented' as const, note: 'Still missing.' }]]),
      [{ ref: 1, status: 'implemented', note: 'Looks done.' }],
      refs,
    );

    expect(merged.get('rec-1')).toEqual({
      status: 'not-implemented',
      note: 'Still missing.',
    });
  });

  it('adopts a model verdict for a priority code could not settle', () => {
    const merged = mergePreviousPriorityOutcomes(
      new Map(),
      [{ ref: 2, status: 'partial', note: 'Half done.' }],
      refs,
    );

    expect(merged.get('rec-2')).toEqual({ status: 'partial', note: 'Half done.' });
  });

  it('drops an unknown or duplicated ref instead of failing the analysis', () => {
    const merged = mergePreviousPriorityOutcomes(
      new Map(),
      [
        { ref: 99, status: 'implemented', note: 'Hallucinated.' },
        { ref: 1, status: 'implemented', note: 'First.' },
        { ref: 1, status: 'not-implemented', note: 'Second.' },
      ],
      refs,
    );

    expect(merged.size).toBe(1);
    expect(merged.get('rec-1')?.note).toBe('First.');
  });

  it('returns the deterministic verdicts untouched when the model returned no reviews', () => {
    const decided = new Map([
      ['rec-1', { status: 'implemented' as const, note: 'Confirmed.' }],
    ]);

    expect(mergePreviousPriorityOutcomes(decided, undefined, refs)).toEqual(decided);
  });
});

describe('attachPreviousOutcomes', () => {
  it('marks a new priority that repeats advice from the previous analysis', () => {
    const [attached] = attachPreviousOutcomes([ranked('overview')], { counts }, {
      analysisId: 'analysis-0',
      priorities: [previousPriority('rec-1')],
      facts: { counts },
      outcomes: new Map([
        ['rec-1', { status: 'not-implemented', note: 'Your overview is unchanged.' }],
      ]),
    });

    expect(attached?.outcome).toEqual({
      outcomeStatus: 'not-implemented',
      outcomeNote: 'Your overview is unchanged.',
      outcomeAnalysisId: 'analysis-0',
    });
  });

  it('matches across the section pair that shares a suggestion target', () => {
    // The previous analysis persisted this under `goalAlignment`; ranking put
    // the same advice under `overview` this time.
    const [attached] = attachPreviousOutcomes([ranked('overview')], { counts }, {
      analysisId: 'analysis-0',
      priorities: [previousPriority('rec-1', { section: 'goalAlignment' })],
      facts: { counts },
      outcomes: new Map([['rec-1', { status: 'partial', note: 'Partly there.' }]]),
    });

    expect(attached?.outcome?.outcomeStatus).toBe('partial');
  });

  it('leaves a brand-new priority unmarked', () => {
    const [attached] = attachPreviousOutcomes([ranked('skills')], { counts }, {
      analysisId: 'analysis-0',
      priorities: [previousPriority('rec-1')],
      facts: { counts },
      outcomes: new Map([['rec-1', { status: 'not-implemented', note: 'Nope.' }]]),
    });

    expect(attached?.outcome).toBeUndefined();
  });

  it('marks nothing on a first analysis', () => {
    expect(
      attachPreviousOutcomes([ranked('overview')], { counts }, null)[0]?.outcome,
    ).toBeUndefined();
  });
});
