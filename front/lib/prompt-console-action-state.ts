import type {
  PromptDryRunResponse,
  PromptPreviewResponse,
  PromptRevision,
} from '@/lib/api/types';

export interface PromptSaveActionResult {
  status: 'success' | 'error';
  message: string;
  revision?: PromptRevision;
}

export interface PromptPreviewActionResult {
  status: 'success' | 'error';
  message: string;
  preview?: PromptPreviewResponse;
}

export interface PromptDryRunActionResult {
  status: 'success' | 'error';
  message: string;
  dryRun?: PromptDryRunResponse;
}

export interface PromptMutationActionResult {
  status: 'success' | 'error';
  message: string;
}
