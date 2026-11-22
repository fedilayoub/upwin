import { renderConfirmedFreelancerContext } from './freelancer-context';
import { renderProfileImproverGoalStrategy } from './goal-strategy';
import { renderProfileImproverOutputNotes } from './output-notes';
import { renderProfileImproverPolicy } from './policy';
import { renderImproverProfileSnapshot } from './profile-snapshot';
import type { ProfileImproverPromptData } from './prompt-data';
import { renderProfileImproverSystem } from './system';
import { renderTargetJobProfile } from '../profile-analyzer/target-job-profile';

export const PROFILE_IMPROVER_PROMPT_VERSION = 'profile-improver-v4' as const;

export interface AssembledProfileImproverPrompt {
  system: string;
  prompt: string;
  promptVersion: typeof PROFILE_IMPROVER_PROMPT_VERSION;
}

export function assembleProfileImproverPrompt(
  data: ProfileImproverPromptData,
): AssembledProfileImproverPrompt {
  return {
    system: renderProfileImproverSystem(),
    prompt: [
      renderProfileImproverPolicy(),
      renderProfileImproverGoalStrategy(data.goal),
      renderConfirmedFreelancerContext(data.context),
      renderTargetJobProfile(data.targetJobProfile),
      renderImproverProfileSnapshot(data.snapshot),
      renderProfileImproverOutputNotes(data),
    ].join('\n\n'),
    promptVersion: PROFILE_IMPROVER_PROMPT_VERSION,
  };
}
