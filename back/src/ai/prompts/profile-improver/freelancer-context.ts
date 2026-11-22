import type { FreelancerContextFields } from '../../../freelancer-context/freelancer-context.schema';

export function renderConfirmedFreelancerContext(
  context: FreelancerContextFields,
): string {
  return [
    '<confirmed_freelancer_context>',
    JSON.stringify(context),
    '</confirmed_freelancer_context>',
  ].join('\n');
}

