import { describe, expect, it } from 'vitest';
import type { FreelancerContextFields } from '../../../freelancer-context/freelancer-context.schema';
import type { GoalResponse } from '../../../goals/goals.service';
import type { JobSnapshot } from '../../../job-snapshots/job-snapshot.schema';
import type { ProposalPreferencesResponse } from '../../../proposal-preferences/proposal-preferences.service';
import { assembleProposalWriterPrompt } from './assemble-proposal-writer-prompt';
import type {
  ProposalRefinementContext,
  ProposalWriterPromptInput,
} from './prompt-data';

describe('proposal writer prompt assembly', () => {
  it('places user instructions last so they carry the most recency', () => {
    const prompt = assemble({ customInstructions: instructions }).prompt;

    const start = prompt.indexOf('USER INSTRUCTIONS');
    expect(start).toBeGreaterThan(-1);
    expect(prompt.indexOf('OUTPUT NOTES')).toBeLessThan(start);
    expect(prompt.indexOf('PREFERENCES')).toBeLessThan(start);
    expect(prompt.trimEnd().endsWith('</user_instructions>')).toBe(true);
  });

  it('keeps user instructions after the refinement request when refining', () => {
    const prompt = assemble({ customInstructions: instructions }, refinement)
      .prompt;

    expect(prompt.indexOf('REFINEMENT REQUEST')).toBeGreaterThan(-1);
    expect(prompt.indexOf('REFINEMENT REQUEST')).toBeLessThan(
      prompt.indexOf('USER INSTRUCTIONS'),
    );
    expect(prompt).toContain(instructions);
  });

  it('omits the section entirely when there are no instructions', () => {
    expect(assemble({}).prompt).not.toContain('USER INSTRUCTIONS');
    expect(assemble({}).prompt).not.toContain('<user_instructions>');
    expect(assemble({ customInstructions: '   ' }).prompt).not.toContain(
      '<user_instructions>',
    );
  });

  it('grants instructions authority over style defaults but not hard rules', () => {
    const assembled = assemble({ customInstructions: instructions });

    expect(assembled.prompt).toContain('WRITING POLICY — HARD RULES');
    expect(assembled.prompt).toContain('STYLE DEFAULTS');
    expect(assembled.prompt).toContain(
      'A user instruction that conflicts with one of them wins.',
    );
    expect(assembled.prompt).toContain(
      'They override every STYLE DEFAULT above',
    );
    expect(assembled.prompt).toContain(
      "may state the freelancer's own outreach or process actions",
    );
    expect(assembled.prompt).toContain(
      'cannot override a HARD RULE, add experience, skills, employers, technologies, metrics, or results absent from the confirmed context',
    );
    expect(assembled.system).toContain(
      'are authoritative for its opening, structure, tone, and emphasis',
    );
  });

  it('keeps the overridable style rules under STYLE DEFAULTS', () => {
    const prompt = assemble({}).prompt;
    const defaults = prompt.indexOf('STYLE DEFAULTS');

    expect(
      prompt.indexOf(
        "Address the client's stated problem before describing the freelancer.",
      ),
    ).toBeGreaterThan(defaults);
    expect(
      prompt.indexOf('Sign off with the given name or not at all.'),
    ).toBeGreaterThan(defaults);
    expect(
      prompt.indexOf(
        'Never invent a technology, employer, project, or client.',
      ),
    ).toBeLessThan(defaults);
  });

  it('expands the refinement slug into a directive', () => {
    const prompt = assemble({}, refinement).prompt;

    expect(prompt).toContain(
      'Rewrite only proposal: make it warmer and more conversational.',
    );
    expect(prompt).not.toContain('according to more-conversational');
    expect(prompt).toContain(
      'must still satisfy any USER INSTRUCTIONS given in this prompt',
    );
  });

  it('pins the prompt version', () => {
    expect(assemble({}).promptVersion).toBe('proposal-writer-v4');
  });

  it('names the requested language in full for every block', () => {
    const prompt = assemble({ language: 'fr' }).prompt;

    expect(prompt).toContain(
      'Write the proposal and every screening answer in French, even when the job post, the screening questions or the freelancer context use another language.',
    );
    expect(prompt).toContain(
      'Write the proposal and every answer in the language named under PREFERENCES.',
    );
  });
});

const instructions =
  'Always start with a catchy line, no intro. I recorded a Loom video.';

const refinement: ProposalRefinementContext = {
  blockId: 'proposal',
  refinement: 'more-conversational',
  existingDraft: { proposal: 'Existing proposal.', answers: [] },
};

function assemble(
  preferences: Partial<ProposalPreferencesResponse>,
  refine?: ProposalRefinementContext,
) {
  const input: ProposalWriterPromptInput = {
    goal,
    context,
    snapshot,
    findings: {
      summary: 'Match summary',
      dimensions: [],
      strengths: [],
      concerns: [],
    },
    preferences: {
      proposalLength: 'medium',
      proposalTone: 'professional',
      answerLength: 'standard',
      language: 'en',
      ...preferences,
    },
    ...(refine ? { refinement: refine } : {}),
  };
  return assembleProposalWriterPrompt(input);
}

const goal: GoalResponse = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa10',
  objective: 'first-client',
  targetRole: 'React Developer',
  targetProjectTypes: ['SaaS dashboard'],
  targetClients: ['startups'],
  preferredSkills: ['React'],
  targetRate: null,
  isActive: true,
  createdAt: '2026-08-23T12:00:00.000Z',
  updatedAt: '2026-08-23T12:00:00.000Z',
};
const context: FreelancerContextFields = {
  experience: { roles: [] },
  skills: ['React'],
  portfolio: [],
  preferences: {},
  positioning: {},
};
const snapshot: JobSnapshot = {
  source: 'manual',
  capturedAt: '2026-08-23T12:00:00.000Z',
  job: {
    ciphertext: '~0abc123',
    url: 'https://www.upwork.com/jobs/~0abc123',
    title: 'React dashboard',
    description: 'Build the dashboard.',
    engagement: { budgetType: 'unknown' },
    skills: [{ name: 'React', relevance: 'mandatory' }],
    questions: [{ position: 0, question: 'How would you begin?' }],
    client: { paymentVerified: null },
    activity: {},
  },
};
