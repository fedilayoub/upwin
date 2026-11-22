'use server';

import { revalidatePath } from 'next/cache';
import type {
  AnalyzerTemplateContent,
  PromptDryRunResponse,
  PromptPreviewResponse,
} from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';
import { getBackendApiClient } from '@/lib/api/server';
import type {
  PromptDryRunActionResult,
  PromptMutationActionResult,
  PromptPreviewActionResult,
  PromptSaveActionResult,
} from '@/lib/prompt-console-action-state';
import { isLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export async function savePromptDraftAction(
  locale: string,
  revisionId: string | null,
  content: AnalyzerTemplateContent,
  notes: string,
): Promise<PromptSaveActionResult> {
  const validLocale = requireLocale(locale);
  const copy = (await getDictionary(validLocale)).promptConsole.messages;
  const path = promptPath(validLocale);
  try {
    const api = await getBackendApiClient();
    const input = { content, notes: notes.trim() || null };
    const revision = revisionId
      ? await api.updatePromptDraft('profileAnalyzer', revisionId, input)
      : await api.createPromptDraft('profileAnalyzer', input);
    revalidatePath(path);
    return { status: 'success', message: copy.draftSaved, revision };
  } catch (error: unknown) {
    return actionError(error, copy.draftSaveError);
  }
}

export async function previewPromptRevisionAction(
  locale: string,
  revisionId: string,
): Promise<PromptPreviewActionResult> {
  const validLocale = requireLocale(locale);
  const copy = (await getDictionary(validLocale)).promptConsole.messages;
  try {
    const api = await getBackendApiClient();
    const preview: PromptPreviewResponse = await api.previewPromptRevision(
      'profileAnalyzer',
      revisionId,
    );
    return { status: 'success', message: copy.previewReady, preview };
  } catch (error: unknown) {
    return actionError(error, copy.previewError);
  }
}

export async function dryRunPromptRevisionAction(
  locale: string,
  revisionId: string,
): Promise<PromptDryRunActionResult> {
  const validLocale = requireLocale(locale);
  const copy = (await getDictionary(validLocale)).promptConsole.messages;
  try {
    const api = await getBackendApiClient();
    const dryRun: PromptDryRunResponse = await api.dryRunPromptRevision(
      'profileAnalyzer',
      revisionId,
    );
    return { status: 'success', message: copy.dryRunReady, dryRun };
  } catch (error: unknown) {
    return actionError(error, copy.dryRunError);
  }
}

export async function activatePromptRevisionAction(
  locale: string,
  revisionId: string,
): Promise<PromptMutationActionResult> {
  const validLocale = requireLocale(locale);
  const copy = (await getDictionary(validLocale)).promptConsole.messages;
  const path = promptPath(validLocale);
  try {
    const api = await getBackendApiClient();
    await api.activatePromptRevision('profileAnalyzer', revisionId);
    revalidatePath(path);
    return { status: 'success', message: copy.published };
  } catch (error: unknown) {
    return actionError(error, copy.publishError);
  }
}

export async function resetPromptCapabilityAction(
  locale: string,
): Promise<PromptMutationActionResult> {
  const validLocale = requireLocale(locale);
  const copy = (await getDictionary(validLocale)).promptConsole.messages;
  const path = promptPath(validLocale);
  try {
    const api = await getBackendApiClient();
    await api.resetPromptCapability('profileAnalyzer');
    revalidatePath(path);
    return { status: 'success', message: copy.reset };
  } catch (error: unknown) {
    return actionError(error, copy.resetError);
  }
}

function requireLocale(locale: string): Locale {
  if (!isLocale(locale)) throw new Error('Unsupported locale.');
  return locale;
}

function promptPath(locale: Locale): string {
  return `/${locale}/settings/prompts`;
}

function actionError(
  error: unknown,
  fallback: string,
): { status: 'error'; message: string } {
  const message = error instanceof ApiError ? error.message : fallback;
  return { status: 'error', message };
}
