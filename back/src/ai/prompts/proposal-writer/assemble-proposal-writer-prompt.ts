import { renderProposalFreelancerContext } from './freelancer-context';
import { renderProposalGoalStrategy } from './goal-strategy';
import { renderProposalJobSnapshot } from './job-snapshot';
import { renderMatchFindings } from './match-findings';
import { renderProposalOutputNotes } from './output-notes';
import { renderProposalPreferences } from './preferences';
import type { ProposalWriterPromptInput } from './prompt-data';
import { renderScreeningQuestions } from './questions';
import { renderRefinement } from './refinement';
import { renderProposalWriterSystem } from './system';
import { renderUserInstructions } from './user-instructions';
import { renderWritingPolicy } from './writing-policy';

export const proposalWriterPromptVersion = 'proposal-writer-v3' as const;

export interface AssembledProposalWriterPrompt {
  system: string;
  prompt: string;
  promptVersion: typeof proposalWriterPromptVersion;
}

export function assembleProposalWriterPrompt(
  input: ProposalWriterPromptInput,
): AssembledProposalWriterPrompt {
  const parts: Array<string | null> = [
    renderWritingPolicy(),
    renderProposalGoalStrategy(input.goal),
    renderProposalFreelancerContext(input.context),
    renderProposalJobSnapshot(input.snapshot),
    renderMatchFindings(input.findings),
    renderProposalPreferences(input.preferences),
    renderScreeningQuestions(input.snapshot),
    renderProposalOutputNotes(input.snapshot),
  ];
  if (input.refinement) parts.push(renderRefinement(input.refinement));
  // Last: recency, and it lands after REFINEMENT REQUEST so a refine keeps obeying it.
  parts.push(renderUserInstructions(input.preferences.customInstructions));

  return {
    system: renderProposalWriterSystem(),
    prompt: parts.filter((part) => part !== null).join('\n\n'),
    promptVersion: proposalWriterPromptVersion,
  };
}
