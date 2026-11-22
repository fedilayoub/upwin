import type { GoalResponse } from '../../../goals/goals.service';
import { serializePromptData } from '../profile-analyzer/prompt-data';

export function renderProposalGoalStrategy(goal: GoalResponse): string {
  return `GOAL STRATEGY
Use the goal to choose emphasis, never to add a fact.
<goal_data>
${serializePromptData({
  objective: goal.objective,
  targetRole: goal.targetRole,
  targetProjectTypes: goal.targetProjectTypes,
  targetClients: goal.targetClients,
  preferredSkills: goal.preferredSkills,
})}
</goal_data>`;
}
