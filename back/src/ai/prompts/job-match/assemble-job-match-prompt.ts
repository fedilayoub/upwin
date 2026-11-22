import type { FreelancerContextFields } from '../../../freelancer-context/freelancer-context.schema';
import type { GoalResponse } from '../../../goals/goals.service';
import type { JobSnapshot } from '../../../job-snapshots/job-snapshot.schema';
import type { JobFacts } from '../../../jobs/analysis/deterministic/job-facts';
import { renderJobDeterministicEvidence } from './deterministic-evidence';
import { renderEvaluationPolicy } from './evaluation-policy';
import { renderJobMatchFreelancerContext } from './freelancer-context';
import { renderJobMatchGoalStrategy } from './goal-strategy';
import { renderEvaluationJobSnapshot } from './job-snapshot';
import { renderJobMatchOutputNotes } from './output-notes';
import { renderJobMatchRubric } from './rubric';
import { renderJobMatchSystem } from './system';

export const jobMatchPromptVersion = 'job-match-v2' as const;

export interface JobMatchPromptInput {
  goal: GoalResponse;
  context: FreelancerContextFields;
  newestProfileSkills: readonly string[];
  facts: JobFacts;
  snapshot: JobSnapshot;
}

export interface AssembledJobMatchPrompt {
  system: string;
  prompt: string;
  promptVersion: typeof jobMatchPromptVersion;
}

export function assembleJobMatchPrompt(
  input: JobMatchPromptInput,
): AssembledJobMatchPrompt {
  return {
    system: renderJobMatchSystem(),
    prompt: [
      renderEvaluationPolicy(),
      renderJobMatchRubric(),
      renderJobMatchGoalStrategy(input.goal),
      renderJobMatchFreelancerContext(
        input.context,
        input.newestProfileSkills,
      ),
      renderJobDeterministicEvidence(input.facts),
      renderEvaluationJobSnapshot(input.snapshot),
      renderJobMatchOutputNotes(),
    ].join('\n\n'),
    promptVersion: jobMatchPromptVersion,
  };
}
