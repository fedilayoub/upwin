import type { GoalResponse } from '../../../goals/goals.service';
import type { AnalyzerTemplateContent } from '../prompt-template.schema';
import { serializePromptData } from './prompt-data';

export function renderGoalStrategy(
  goal: GoalResponse,
  strategies: AnalyzerTemplateContent['goalStrategies'],
): string {
  return `GOAL STRATEGY
Objective: ${goal.objective}
Evaluation emphasis: ${strategies[goal.objective]}
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
