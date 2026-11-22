import type { GoalResponse } from '../../../goals/goals.service';
import { serializePromptData } from '../profile-analyzer/prompt-data';

const STRATEGIES: Record<GoalResponse['objective'], string> = {
  'first-client':
    'Emphasize demonstrable skill coverage, approachable scope, and credible evidence for winning an initial client.',
  'more-clients':
    'Emphasize repeatable relevance across the requested work and evidence that supports dependable delivery.',
  'more-responses':
    'Emphasize immediate role, domain, and project-type alignment that can make a proposal specifically relevant.',
  'higher-paying-projects':
    'Emphasize specialization, directly relevant experience, proof depth, and alignment with premium target work.',
  scale:
    'Emphasize repeated relevant delivery, mature domain proof, and work aligned with larger or repeatable engagements.',
};

export function renderJobMatchGoalStrategy(goal: GoalResponse): string {
  return `GOAL STRATEGY
Objective: ${goal.objective}
Evaluation emphasis: ${STRATEGIES[goal.objective]}
<goal_data>
${serializePromptData({
  targetRole: goal.targetRole,
  targetProjectTypes: goal.targetProjectTypes,
  targetClients: goal.targetClients,
  preferredSkills: goal.preferredSkills,
  targetRate: goal.targetRate,
})}
</goal_data>`;
}
