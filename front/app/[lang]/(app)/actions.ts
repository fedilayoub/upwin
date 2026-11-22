'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { getBackendApiClient } from '@/lib/api/server';
import {
  canConfirmFreelancerContext,
  rawFreelancerContextInput,
  validateFreelancerContextInput,
} from '@/lib/context-validation';
import { isContextDeletionConfirmed } from '@/lib/context-reset';
import { rawGoalInput, validateGoalInput } from '@/lib/goal-validation';
import {
  rawProposalPreferencesInput,
  validateProposalPreferencesInput,
} from '@/lib/proposal-preferences-validation';
import {
  rawProposalOutcomeInput,
  validateProposalOutcomeInput,
} from '@/lib/proposal-outcome-validation';
import { isLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import type { FormActionState } from '@/lib/form-action-state';

export async function createGoalAction(
  localeValue: string,
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  void _previousState;
  const locale = requireLocale(localeValue);
  const copy = (await getDictionary(locale)).goals;
  const validation = validateGoalInput(rawGoalInput(formData));
  if (!validation.success) {
    return {
      status: 'error',
      message: copy.validation.checkFields,
      fieldErrors: validation.errors,
    };
  }

  try {
    const api = await getBackendApiClient();
    await api.createGoal(validation.data);
  } catch (error: unknown) {
    return actionError(error, copy.messages.genericError);
  }

  revalidatePath(`/${locale}/goals`);
  return { status: 'success', message: copy.messages.created };
}

export async function updateGoalAction(
  localeValue: string,
  goalId: string,
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const locale = requireLocale(localeValue);
  const copy = (await getDictionary(locale)).goals;
  const validation = validateGoalInput(rawGoalInput(formData));
  if (!validation.success) {
    return {
      status: 'error',
      message: copy.validation.checkFields,
      fieldErrors: validation.errors,
    };
  }

  try {
    const api = await getBackendApiClient();
    await api.updateGoal(goalId, validation.data);
  } catch (error: unknown) {
    return actionError(error, copy.messages.genericError);
  }

  revalidatePath(`/${locale}/goals`);
  return { status: 'success', message: copy.messages.updated };
}

export async function activateGoalAction(
  localeValue: string,
  goalId: string,
  _previousState: FormActionState,
): Promise<FormActionState> {
  void _previousState;
  const locale = requireLocale(localeValue);
  const copy = (await getDictionary(locale)).goals;

  try {
    const api = await getBackendApiClient();
    await api.updateGoal(goalId, { isActive: true });
  } catch (error: unknown) {
    return actionError(error, copy.messages.genericError);
  }

  revalidatePath(`/${locale}/goals`);
  return { status: 'success', message: copy.messages.activated };
}

export async function deleteGoalAction(
  localeValue: string,
  goalId: string,
  _previousState: FormActionState,
): Promise<FormActionState> {
  void _previousState;
  const locale = requireLocale(localeValue);
  const copy = (await getDictionary(locale)).goals;

  try {
    const api = await getBackendApiClient();
    await api.deleteGoal(goalId);
  } catch (error: unknown) {
    return actionError(error, copy.messages.deleteError);
  }

  revalidatePath(`/${locale}/goals`);
  return { status: 'success', message: copy.messages.deleted };
}

export async function saveProposalPreferencesAction(
  localeValue: string,
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  void _previousState;
  const locale = requireLocale(localeValue);
  const copy = (await getDictionary(locale)).proposals;
  const validation = validateProposalPreferencesInput(
    rawProposalPreferencesInput(formData),
  );
  if (!validation.success) {
    return {
      status: 'error',
      message: copy.validation.checkFields,
      fieldErrors: validation.errors,
    };
  }

  try {
    const api = await getBackendApiClient();
    await api.putProposalPreferences(validation.data);
  } catch (error: unknown) {
    return actionError(error, copy.messages.genericError);
  }

  revalidatePath(`/${locale}/proposal-style`);
  return { status: 'success', message: copy.messages.saved };
}

export async function saveProposalOutcomeAction(
  localeValue: string,
  jobAnalysisId: string,
  formData: FormData,
): Promise<FormActionState> {
  const locale = requireLocale(localeValue);
  const copy = (await getDictionary(locale)).dashboard.applications;
  const validation = validateProposalOutcomeInput(
    rawProposalOutcomeInput(formData),
  );
  if (!validation.success) {
    return {
      status: 'error',
      message: copy.validation.checkFields,
      fieldErrors: validation.errors,
    };
  }

  try {
    const api = await getBackendApiClient();
    await api.putProposalOutcome(jobAnalysisId, validation.data);
  } catch (error: unknown) {
    return actionError(error, copy.messages.genericError);
  }

  revalidatePath(`/${locale}`);
  return { status: 'success', message: copy.messages.saved };
}

export async function uploadCvAction(
  localeValue: string,
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const locale = requireLocale(localeValue);
  const copy = (await getDictionary(locale)).onboarding;
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0 || file.type !== 'application/pdf') {
    return { status: 'error', message: copy.upload.invalidFile };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { status: 'error', message: copy.upload.tooLarge };
  }

  let replaced = false;
  try {
    const api = await getBackendApiClient();
    const response = await api.uploadCv(file);
    replaced = response.replaced;
  } catch (error: unknown) {
    return actionError(error, copy.review.genericError);
  }

  revalidatePath(`/${locale}/context`);
  redirect(
    `/${locale}/context/review${replaced ? '?replaced=1' : ''}`,
  );
}

export async function saveManualContextAction(
  localeValue: string,
  mode: 'create' | 'update',
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const locale = requireLocale(localeValue);
  const copy = (await getDictionary(locale)).onboarding;
  const validation = validateFreelancerContextInput(
    rawFreelancerContextInput(formData),
  );
  if (!validation.success) {
    return {
      status: 'error',
      message: copy.validation.checkFields,
      fieldErrors: validation.errors,
    };
  }

  try {
    const api = await getBackendApiClient();
    if (mode === 'create') {
      await api.createFreelancerContext(validation.data);
    } else {
      await api.updateFreelancerContext(validation.data);
    }
  } catch (error: unknown) {
    return actionError(error, copy.review.genericError);
  }

  revalidatePath(`/${locale}/context`);
  revalidatePath(`/${locale}/context/review`);
  redirect(`/${locale}/context/review`);
}

export async function confirmFreelancerContextAction(
  localeValue: string,
  _previousState: FormActionState,
): Promise<FormActionState> {
  void _previousState;
  const locale = requireLocale(localeValue);
  const copy = (await getDictionary(locale)).onboarding.review;

  try {
    const api = await getBackendApiClient();
    const draft = await api.getFreelancerContext();
    if (!draft || !canConfirmFreelancerContext(draft)) {
      return { status: 'error', message: copy.cannotConfirm };
    }
    await api.confirmFreelancerContext();
  } catch (error: unknown) {
    return actionError(error, copy.genericError);
  }

  revalidatePath(`/${locale}/context`);
  revalidatePath(`/${locale}/context/review`);
  return { status: 'success', message: copy.confirmed };
}

export async function deleteFreelancerContextAction(
  localeValue: string,
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  void _previousState;
  const locale = requireLocale(localeValue);
  const copy = (await getDictionary(locale)).onboarding.review;
  if (!isContextDeletionConfirmed(formData)) {
    return { status: 'error', message: copy.deleteConfirmationRequired };
  }

  try {
    const api = await getBackendApiClient();
    await api.deleteFreelancerContext();
  } catch (error: unknown) {
    return actionError(error, copy.genericError);
  }

  revalidatePath(`/${locale}/context`);
  revalidatePath(`/${locale}/context/review`);
  redirect(`/${locale}/context`);
}

function actionError(error: unknown, fallback: string): FormActionState {
  const canSurfaceApiMessage =
    error instanceof ApiError &&
    error.code !== 'UNAUTHENTICATED' &&
    error.code !== 'UNKNOWN_ERROR';
  return {
    status: 'error',
    message: canSurfaceApiMessage ? error.message : fallback,
  };
}

function requireLocale(value: string): Locale {
  if (!isLocale(value)) throw new Error('Unsupported locale.');
  return value;
}
