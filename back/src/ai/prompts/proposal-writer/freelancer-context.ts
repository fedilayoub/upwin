import type { FreelancerContextFields } from '../../../freelancer-context/freelancer-context.schema';
import { serializePromptData } from '../profile-analyzer/prompt-data';

export function renderProposalFreelancerContext(
  context: FreelancerContextFields,
): string {
  return `CONFIRMED FREELANCER CONTEXT
This is the sole source for factual claims about the freelancer.
<freelancer_context>
${serializePromptData(context)}
</freelancer_context>`;
}
