'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api';
import { getBackendApiClient } from '@/lib/api/server';
import {
  rawProposalOutcomeInput,
  validateProposalOutcomeInput,
} from '@/lib/proposal-outcome-validation';
import { isLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import type { FormActionState } from '@/lib/form-action-state';

export async function moveApplicationAction(
  localeValue: string,
  jobAnalysisId: string,
  formData: FormData,
): Promise<FormActionState> {
  const locale = requireLocale(localeValue);
  const copy = (await getDictionary(locale)).applications;
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
    const canSurfaceApiMessage =
      error instanceof ApiError &&
      error.code !== 'UNAUTHENTICATED' &&
      error.code !== 'UNKNOWN_ERROR';
    return {
      status: 'error',
      message: canSurfaceApiMessage
        ? error.message
        : copy.messages.genericError,
    };
  }

  // The dashboard funnel and its applications table read the same rows.
  revalidatePath(`/${locale}/applications`);
  revalidatePath(`/${locale}`);
  return { status: 'success', message: copy.messages.saved };
}

function requireLocale(value: string): Locale {
  if (!isLocale(value)) throw new Error('Unsupported locale.');
  return value;
}
