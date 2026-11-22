import type {
  ProfileRewriteSuggestion,
  ProfileSuggestion,
} from '@/types/profile';
import { getErrorCode } from '@/services/api';

export interface ClipboardWriter {
  writeText(value: string): Promise<void>;
}

export async function copyProfileSuggestion(
  suggestion: ProfileRewriteSuggestion,
  clipboard: ClipboardWriter,
  markCopied: (recommendationId: string) => Promise<unknown>,
): Promise<void> {
  await clipboard.writeText(suggestion.suggestedValue);
  await markCopied(suggestion.id);
}

export interface SuggestionReplacement {
  suggestion: ProfileSuggestion | null;
  error: string | null;
  errorCode: string | null;
}

export async function requestSuggestionKeepingCurrent(
  current: ProfileSuggestion | null,
  request: () => Promise<ProfileSuggestion>,
): Promise<SuggestionReplacement> {
  try {
    return { suggestion: await request(), error: null, errorCode: null };
  } catch (error: unknown) {
    return {
      suggestion: current,
      error: error instanceof Error ? error.message : 'Unable to generate another suggestion.',
      errorCode: getErrorCode(error),
    };
  }
}
