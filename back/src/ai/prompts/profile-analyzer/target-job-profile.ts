import type { TargetJobProfile } from '../../../profile/analysis/deterministic/profile-facts';
import { serializePromptData } from './prompt-data';

export function renderTargetJobProfile(target: TargetJobProfile): string {
  return `TARGET JOB PROFILE
<target_job_profile>
${serializePromptData(target)}
</target_job_profile>`;
}
