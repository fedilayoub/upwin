import type { FreelancerContextFields } from '../../../freelancer-context/freelancer-context.schema';
import type { GoalResponse } from '../../../goals/goals.service';
import type {
  ProfileFacts,
  TargetJobProfile,
} from '../../../profile/analysis/deterministic/profile-facts';
import { profileRubricV1 } from '../../../profile/analysis/rubric/upwork-profile-v1';
import type { PreviousPriority } from '../../../profile/recommendations/verify-previous-priorities';
import type { ProfileSnapshot } from '../../../profile-snapshots/profile-snapshot.schema';
import type { AnalyzerTemplateContent } from '../prompt-template.schema';
import { renderAnalyzerPolicy } from './analyzer-policy';
import { DEFAULT_ANALYZER_TEMPLATE } from './default-analyzer-template';
import { renderDeterministicEvidence } from './deterministic-evidence';
import { renderFreelancerContext } from './freelancer-context';
import { renderGoalStrategy } from './goal-strategy';
import { renderOutputNotes } from './output-notes';
import {
  renderPreviousPriorities,
  type RenderedPreviousPriorities,
} from './previous-priorities';
import { renderProfileSnapshot } from './profile-snapshot';
import { renderRubricPrompt } from './rubric';
import { renderSystemPrompt } from './system';
import { renderTargetJobProfile } from './target-job-profile';

export const profileAnalyzerPromptVersion = 'profile-analyzer-v6' as const;

export interface ProfileAnalyzerPromptInput {
  goal: GoalResponse;
  context: FreelancerContextFields;
  targetJobProfile: TargetJobProfile;
  snapshot: ProfileSnapshot;
  facts: ProfileFacts;
  /**
   * Priorities from the previous analysis that code could not settle from the
   * snapshot alone. Empty on a first analysis and after a goal change.
   */
  previousPriorities?: readonly PreviousPriority[];
}

export interface AssembledProfileAnalyzerPrompt {
  system: string;
  prompt: string;
  promptVersion: string;
  /**
   * Carried on the assembled prompt so the caller resolves the model's ordinal
   * references against the exact list that was rendered, rather than rebuilding
   * the ordering later and risking a mismatch.
   */
  previousPriorityRefs: RenderedPreviousPriorities['refs'];
}

export function assembleProfileAnalyzerPrompt(
  input: ProfileAnalyzerPromptInput,
  template: AnalyzerTemplateContent = DEFAULT_ANALYZER_TEMPLATE,
  revisionNumber: number | null = null,
): AssembledProfileAnalyzerPrompt {
  const previous = renderPreviousPriorities(input.previousPriorities ?? []);

  return {
    system: renderSystemPrompt(template.systemPersona),
    prompt: [
      renderAnalyzerPolicy(template.policy),
      renderRubricPrompt(profileRubricV1, template.criterionAnchors),
      renderGoalStrategy(input.goal, template.goalStrategies),
      renderFreelancerContext(input.context),
      renderTargetJobProfile(input.targetJobProfile),
      renderDeterministicEvidence(input.facts),
      renderProfileSnapshot(input.snapshot),
      ...(previous.block === null ? [] : [previous.block]),
      renderOutputNotes(previous.refs.length),
    ].join('\n\n'),
    promptVersion:
      revisionNumber === null
        ? profileAnalyzerPromptVersion
        : `${profileAnalyzerPromptVersion}+r${revisionNumber}`,
    previousPriorityRefs: previous.refs,
  };
}
