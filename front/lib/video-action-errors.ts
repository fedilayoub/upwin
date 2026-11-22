import { ApiError } from '@/lib/api/client';
import type { Dictionary } from '@/i18n/types';

export function videoActionError(
  error: unknown,
  copy: Dictionary['videos']['errors'],
): { status: 'error'; message: string } {
  const keys: Record<string, keyof typeof copy> = {
    VIDEO_NOT_FOUND: 'notFound',
    VIDEO_NOT_CONFIGURED: 'notConfigured',
    VIDEO_STORAGE_ERROR: 'storage',
    UNAUTHENTICATED: 'unauthenticated',
    FORBIDDEN: 'forbidden',
    VALIDATION_FAILED: 'invalid',
  };
  const key =
    error instanceof ApiError ? (keys[error.code] ?? 'generic') : 'generic';
  return { status: 'error', message: copy[key] };
}
