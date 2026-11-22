import type { GoalResponse } from '../../../goals/goals.service';
import { DEFAULT_ANALYZER_TEMPLATE } from '../profile-analyzer/default-analyzer-template';
import { renderGoalStrategy } from '../profile-analyzer/goal-strategy';

export function renderProfileImproverGoalStrategy(goal: GoalResponse): string {
  return renderGoalStrategy(
    goal,
    DEFAULT_ANALYZER_TEMPLATE.goalStrategies,
  ).replace(
    'Evaluation emphasis:',
    'Improvement emphasis:',
  );
}
