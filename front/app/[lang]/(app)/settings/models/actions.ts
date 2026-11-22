'use server';

import { revalidatePath } from 'next/cache';
import { isLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { ApiError } from '@/lib/api/client';
import { getBackendApiClient } from '@/lib/api/server';
import type { ModelSelectableCapability } from '@/lib/api/types';
import type {
  ModelMutationActionResult,
  ModelProbeActionResult,
} from '@/lib/model-console-action-state';

export async function saveCapabilityModelsAction(
  locale: string,
  capability: ModelSelectableCapability,
  primaryModelId: string,
  fallbackModelId: string,
  notes: string,
): Promise<ModelMutationActionResult> {
  const validLocale = requireLocale(locale);
  const copy = (await getDictionary(validLocale)).modelConsole.messages;
  try {
    const api = await getBackendApiClient();
    const updated = await api.setCapabilityModels(capability, {
      primaryModelId,
      fallbackModelId,
      notes: notes.trim() || null,
    });
    revalidatePath(modelConsolePath(validLocale));
    return { status: 'success', message: copy.saved, capability: updated };
  } catch (error: unknown) {
    return actionError(error, copy.saveError);
  }
}

export async function clearCapabilityModelsAction(
  locale: string,
  capability: ModelSelectableCapability,
): Promise<ModelMutationActionResult> {
  const validLocale = requireLocale(locale);
  const copy = (await getDictionary(validLocale)).modelConsole.messages;
  try {
    const api = await getBackendApiClient();
    const updated = await api.clearCapabilityModels(capability);
    revalidatePath(modelConsolePath(validLocale));
    return { status: 'success', message: copy.reset, capability: updated };
  } catch (error: unknown) {
    return actionError(error, copy.resetError);
  }
}

export async function probeCapabilityModelsAction(
  locale: string,
  capability: ModelSelectableCapability,
): Promise<ModelProbeActionResult> {
  const validLocale = requireLocale(locale);
  const copy = (await getDictionary(validLocale)).modelConsole.messages;
  try {
    const api = await getBackendApiClient();
    const probe = await api.probeCapabilityModels(capability);
    return { status: 'success', message: copy.probeReady, probe };
  } catch (error: unknown) {
    return actionError(error, copy.probeError);
  }
}

function requireLocale(locale: string): Locale {
  if (!isLocale(locale)) throw new Error('Unsupported locale.');
  return locale;
}

function modelConsolePath(locale: Locale): string {
  return `/${locale}/settings/models`;
}

function actionError(
  error: unknown,
  fallback: string,
): { status: 'error'; message: string } {
  return {
    status: 'error',
    message: error instanceof ApiError ? error.message : fallback,
  };
}
