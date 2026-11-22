import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteFreelancerContextAction,
  deleteGoalAction,
} from '@/app/[lang]/(app)/actions';
import { ApiError } from '@/lib/api';
import {
  CONTEXT_DELETE_CONFIRMATION_FIELD,
  CONTEXT_DELETE_CONFIRMATION_VALUE,
} from '@/lib/context-reset';
import { INITIAL_FORM_ACTION_STATE } from '@/lib/form-action-state';

const mocks = vi.hoisted(() => ({
  deleteFreelancerContext: vi.fn(),
  deleteGoal: vi.fn(),
  getBackendApiClient: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/api/server', () => ({
  getBackendApiClient: mocks.getBackendApiClient,
}));
vi.mock('@/i18n/dictionaries', () => ({
  getDictionary: vi.fn(async () => ({
    goals: {
      messages: {
        deleted: 'The goal was deleted.',
        deleteError: 'Could not delete the goal.',
      },
    },
    onboarding: {
      review: {
        deleteConfirmationRequired: 'Confirm deletion first.',
        genericError: 'Could not delete context.',
      },
    },
  })),
}));

describe('deleteFreelancerContextAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBackendApiClient.mockResolvedValue({
      deleteFreelancerContext: mocks.deleteFreelancerContext,
      deleteGoal: mocks.deleteGoal,
    });
  });

  it('blocks deletion unless the explicit confirmation is submitted', async () => {
    await expect(
      deleteFreelancerContextAction(
        'en',
        INITIAL_FORM_ACTION_STATE,
        new FormData(),
      ),
    ).resolves.toEqual({
      status: 'error',
      message: 'Confirm deletion first.',
    });
    expect(mocks.getBackendApiClient).not.toHaveBeenCalled();
    expect(mocks.deleteFreelancerContext).not.toHaveBeenCalled();
  });

  it('deletes and redirects to the empty onboarding choice', async () => {
    const formData = new FormData();
    formData.set(
      CONTEXT_DELETE_CONFIRMATION_FIELD,
      CONTEXT_DELETE_CONFIRMATION_VALUE,
    );

    await expect(
      deleteFreelancerContextAction(
        'en',
        INITIAL_FORM_ACTION_STATE,
        formData,
      ),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.deleteFreelancerContext).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/en/context');
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      '/en/context/review',
    );
    expect(mocks.redirect).toHaveBeenCalledWith('/en/context');
  });
});

describe('deleteGoalAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBackendApiClient.mockResolvedValue({ deleteGoal: mocks.deleteGoal });
  });

  it('deletes the goal and revalidates the goals page', async () => {
    await expect(
      deleteGoalAction('en', 'goal-one', INITIAL_FORM_ACTION_STATE),
    ).resolves.toEqual({
      status: 'success',
      message: 'The goal was deleted.',
    });
    expect(mocks.deleteGoal).toHaveBeenCalledWith('goal-one');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/en/goals');
  });

  it('surfaces the GOAL_IN_USE message the backend returned', async () => {
    mocks.deleteGoal.mockRejectedValue(
      new ApiError('Saved analyses use this goal.', 'GOAL_IN_USE', 409),
    );

    await expect(
      deleteGoalAction('en', 'goal-one', INITIAL_FORM_ACTION_STATE),
    ).resolves.toEqual({
      status: 'error',
      message: 'Saved analyses use this goal.',
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('hides an unknown backend failure behind localized copy', async () => {
    mocks.deleteGoal.mockRejectedValue(new Error('socket hang up'));

    await expect(
      deleteGoalAction('en', 'goal-one', INITIAL_FORM_ACTION_STATE),
    ).resolves.toEqual({
      status: 'error',
      message: 'Could not delete the goal.',
    });
  });
});
