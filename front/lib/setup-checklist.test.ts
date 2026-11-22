import { describe, expect, it } from 'vitest';
import {
  buildSetupSteps,
  isSetupComplete,
  setupContextState,
  type SetupProgress,
} from '@/lib/setup-checklist';

const fresh: SetupProgress = { context: 'missing', hasActiveGoal: false, hasAnalysis: false };

function states(progress: SetupProgress) {
  return Object.fromEntries(buildSetupSteps(progress).map((step) => [step.id, step.state]));
}

describe('setup checklist', () => {
  it('starts a new user on their details and locks the extension', () => {
    expect(states(fresh)).toEqual({ skills: 'current', goal: 'todo', extension: 'locked' });
  });

  it('does not count saved but unconfirmed details as done', () => {
    expect(states({ ...fresh, context: 'unconfirmed' })).toEqual({
      skills: 'current',
      goal: 'todo',
      extension: 'locked',
    });
  });

  it('moves to the goal once details are confirmed', () => {
    expect(states({ ...fresh, context: 'confirmed' })).toEqual({
      skills: 'done',
      goal: 'current',
      extension: 'locked',
    });
  });

  it('keeps the extension locked when only the goal exists', () => {
    expect(states({ ...fresh, hasActiveGoal: true })).toEqual({
      skills: 'current',
      goal: 'done',
      extension: 'locked',
    });
  });

  it('unlocks the extension once details and goal are both in', () => {
    const steps = buildSetupSteps({ ...fresh, context: 'confirmed', hasActiveGoal: true });
    expect(steps.at(-1)).toEqual({ id: 'extension', state: 'current' });
    expect(isSetupComplete(steps)).toBe(false);
  });

  it('still asks for a missing goal after a first analysis', () => {
    expect(states({ context: 'confirmed', hasActiveGoal: false, hasAnalysis: true })).toEqual({
      skills: 'done',
      goal: 'current',
      extension: 'done',
    });
  });

  it('is complete when all three are done', () => {
    const steps = buildSetupSteps({ context: 'confirmed', hasActiveGoal: true, hasAnalysis: true });
    expect(isSetupComplete(steps)).toBe(true);
  });

  it('reads the context state from the saved context', () => {
    expect(setupContextState(null)).toBe('missing');
    expect(setupContextState({ confirmedAt: null })).toBe('unconfirmed');
    expect(setupContextState({ confirmedAt: '2026-11-13T09:00:00.000Z' })).toBe('confirmed');
  });
});
