/**
 * The first-run setup path shown on the dashboard: details, then a goal, then
 * the extension. The order is the product's: an analysis needs a confirmed
 * context and an active goal, so the extension step stays locked until both
 * exist. This only decides what the dashboard shows. The backend still
 * enforces the same requirements on every analysis.
 */
export const SETUP_STEP_IDS = ['skills', 'goal', 'extension'] as const;

export type SetupStepId = (typeof SETUP_STEP_IDS)[number];
/** `current` is the next step to do; `todo` can be done but is not next; `locked` cannot start yet. */
export type SetupStepState = 'done' | 'current' | 'todo' | 'locked';
/** `unconfirmed`: details are saved but the freelancer has not confirmed them. */
export type SetupContextState = 'missing' | 'unconfirmed' | 'confirmed';

export interface SetupProgress {
  context: SetupContextState;
  hasActiveGoal: boolean;
  hasAnalysis: boolean;
}

export interface SetupStep {
  id: SetupStepId;
  state: SetupStepState;
}

export function setupContextState(
  context: { confirmedAt: string | null } | null,
): SetupContextState {
  if (context === null) return 'missing';
  return context.confirmedAt === null ? 'unconfirmed' : 'confirmed';
}

export function buildSetupSteps(progress: SetupProgress): SetupStep[] {
  const prerequisitesDone = progress.context === 'confirmed' && progress.hasActiveGoal;
  const done: Record<SetupStepId, boolean> = {
    skills: progress.context === 'confirmed',
    goal: progress.hasActiveGoal,
    extension: progress.hasAnalysis,
  };
  const next = SETUP_STEP_IDS.find((id) => !done[id]);

  return SETUP_STEP_IDS.map((id) => {
    if (done[id]) return { id, state: 'done' };
    if (id === 'extension' && !prerequisitesDone) return { id, state: 'locked' };
    return { id, state: id === next ? 'current' : 'todo' };
  });
}

export function isSetupComplete(steps: readonly SetupStep[]): boolean {
  return steps.every((step) => step.state === 'done');
}
