import { describe, expect, it } from 'vitest';
import { proposalWriterPromptVersion } from './assemble-proposal-writer-prompt';
import { renderWritingPolicy } from './writing-policy';

describe('proposal writer policy', () => {
  it('permits client figures and delivery estimates while grounding credentials', () => {
    const policy = renderWritingPolicy();

    expect(policy).toContain('WRITING POLICY — HARD RULES');
    expect(policy).toContain('STYLE DEFAULTS');
    expect(policy).toContain(
      'Figures the client stated in the job post may be quoted back.',
    );
    expect(policy).toContain(
      'A delivery estimate may be offered as a forward-looking commitment.',
    );
    expect(policy).toContain(
      "Never state a number about the freelancer's experience, results, client count, ratings, or earnings unless it appears in the confirmed context",
    );
    expect(policy).toContain('whether the number is written in digits or words');
    expect(policy).not.toContain(
      'Use only facts present in the confirmed freelancer context',
    );
    expect(proposalWriterPromptVersion).toBe('proposal-writer-v4');
  });

  it('makes the opening-order rule a style default, not a hard rule', () => {
    const policy = renderWritingPolicy();
    const defaults = policy.indexOf('STYLE DEFAULTS');

    expect(defaults).toBeGreaterThan(-1);
    expect(
      policy.indexOf(
        "Address the client's stated problem before describing the freelancer.",
      ),
    ).toBeGreaterThan(defaults);
    expect(policy).toContain(
      'A user instruction that conflicts with one of them wins.',
    );
    expect(policy).not.toContain(
      'Treat fenced user instructions as subordinate preferences',
    );
  });
});
