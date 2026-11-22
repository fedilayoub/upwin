import {
  isProfileCaptureResult,
  type ProfileCaptureResult,
} from '@/features/upwork/profile/schema';
import { isJobCaptureResult } from '@/features/upwork/job/schema';
import type { JobCaptureResult, JobPageStatus } from '@/types/job';
import type { ProfilePageStatus } from '@/types/profile';

const PROTOCOL_VERSION = 1 as const;

export interface RuntimeStatus {
  connected: boolean;
  version: string;
}

export type SidePanelState = 'open' | 'closed';

export interface SidePanelToggleResult {
  state: SidePanelState;
}

/**
 * The one place a request type and its success payload are tied together.
 * Adding a request means adding a member here, a member to ExtensionRequest, a
 * data guard, and a case in the worker — the compiler asks for all four.
 */
export interface ExtensionRequestDataMap {
  CAPTURE_JOB: JobCaptureResult;
  CAPTURE_PROFILE: ProfileCaptureResult;
  GET_JOB_PAGE_STATUS: JobPageStatus;
  GET_PROFILE_PAGE_STATUS: ProfilePageStatus;
  GET_RUNTIME_STATUS: RuntimeStatus;
  START_PROPOSAL_DRAFT: SidePanelToggleResult;
  START_PROFILE_ANALYSIS: SidePanelToggleResult;
  TOGGLE_SIDE_PANEL: SidePanelToggleResult;
}

export type ExtensionRequestType = keyof ExtensionRequestDataMap;

/**
 * A union rather than one shape parameterised by `type`, so a future request
 * can carry a payload without reshaping every existing member.
 */
type RequestEnvelope<T extends ExtensionRequestType> = {
  requestId: string;
  type: T;
  v: typeof PROTOCOL_VERSION;
};

export type ExtensionRequest =
  | RequestEnvelope<'CAPTURE_JOB'>
  | RequestEnvelope<'CAPTURE_PROFILE'>
  | RequestEnvelope<'GET_JOB_PAGE_STATUS'>
  | RequestEnvelope<'GET_PROFILE_PAGE_STATUS'>
  | RequestEnvelope<'GET_RUNTIME_STATUS'>
  | RequestEnvelope<'START_PROPOSAL_DRAFT'>
  | RequestEnvelope<'START_PROFILE_ANALYSIS'>
  | RequestEnvelope<'TOGGLE_SIDE_PANEL'>;

export type RequestOf<T extends ExtensionRequestType> = Extract<
  ExtensionRequest,
  { type: T }
>;

/**
 * What prompted the background worker to suspect the shared session changed.
 * Carried for diagnostics only — every reason triggers the same revalidation.
 */
export type ExtensionErrorCode =
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'JOB_CAPTURE_FAILED'
  | 'JOB_NOT_DETECTED'
  | 'OWN_PROFILE_NOT_DETECTED'
  | 'PROFILE_CAPTURE_FAILED'
  | 'UNSUPPORTED_PAGE'
  | 'RUNTIME_ERROR';

export type ExtensionResponse<
  T extends ExtensionRequestType = ExtensionRequestType,
> =
  | {
      data: ExtensionRequestDataMap[T];
      ok: true;
      requestId: string;
    }
  | {
      error: {
        code: ExtensionErrorCode;
        message: string;
        retryable: boolean;
      };
      ok: false;
      requestId: string;
    };

export function createRuntimeStatusRequest(): RequestOf<'GET_RUNTIME_STATUS'> {
  return {
    requestId: crypto.randomUUID(),
    type: 'GET_RUNTIME_STATUS',
    v: PROTOCOL_VERSION,
  };
}

export function createCaptureProfileRequest(): RequestOf<'CAPTURE_PROFILE'> {
  return {
    requestId: crypto.randomUUID(),
    type: 'CAPTURE_PROFILE',
    v: PROTOCOL_VERSION,
  };
}

export function createCaptureJobRequest(): RequestOf<'CAPTURE_JOB'> {
  return {
    requestId: crypto.randomUUID(),
    type: 'CAPTURE_JOB',
    v: PROTOCOL_VERSION,
  };
}

export function createJobPageStatusRequest(): RequestOf<'GET_JOB_PAGE_STATUS'> {
  return {
    requestId: crypto.randomUUID(),
    type: 'GET_JOB_PAGE_STATUS',
    v: PROTOCOL_VERSION,
  };
}

export function createProfilePageStatusRequest(): RequestOf<'GET_PROFILE_PAGE_STATUS'> {
  return {
    requestId: crypto.randomUUID(),
    type: 'GET_PROFILE_PAGE_STATUS',
    v: PROTOCOL_VERSION,
  };
}

/**
 * Opens the side panel and asks it to analyse the current profile. Distinct
 * from TOGGLE_SIDE_PANEL because it must never close an open panel: the user
 * asked for an analysis, not for the panel to disappear.
 */
export function createStartProfileAnalysisRequest(): RequestOf<'START_PROFILE_ANALYSIS'> {
  return {
    requestId: crypto.randomUUID(),
    type: 'START_PROFILE_ANALYSIS',
    v: PROTOCOL_VERSION,
  };
}

export function createStartProposalDraftRequest(): RequestOf<'START_PROPOSAL_DRAFT'> {
  return {
    requestId: crypto.randomUUID(),
    type: 'START_PROPOSAL_DRAFT',
    v: PROTOCOL_VERSION,
  };
}

export function createToggleSidePanelRequest(): RequestOf<'TOGGLE_SIDE_PANEL'> {
  return {
    requestId: crypto.randomUUID(),
    type: 'TOGGLE_SIDE_PANEL',
    v: PROTOCOL_VERSION,
  };
}

/**
 * Generic so it satisfies any ExtensionResponse<T>: it only ever builds the
 * ok:false branch, which carries no request-specific data.
 */
export function createErrorResponse<
  T extends ExtensionRequestType = ExtensionRequestType,
>(
  requestId: string,
  code: ExtensionErrorCode,
  message: string,
): ExtensionResponse<T> {
  return {
    error: {
      code,
      message,
      retryable:
        code === 'RUNTIME_ERROR' ||
        code === 'PROFILE_CAPTURE_FAILED' ||
        code === 'JOB_CAPTURE_FAILED',
    },
    ok: false,
    requestId,
  };
}

const REQUEST_TYPES: ReadonlySet<string> = new Set<ExtensionRequestType>([
  'CAPTURE_JOB',
  'CAPTURE_PROFILE',
  'GET_JOB_PAGE_STATUS',
  'GET_PROFILE_PAGE_STATUS',
  'GET_RUNTIME_STATUS',
  'START_PROPOSAL_DRAFT',
  'START_PROFILE_ANALYSIS',
  'TOGGLE_SIDE_PANEL',
]);

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
  if (!isRecord(value)) return false;

  return (
    value.v === PROTOCOL_VERSION &&
    typeof value.type === 'string' &&
    REQUEST_TYPES.has(value.type) &&
    typeof value.requestId === 'string' &&
    value.requestId.length > 0 &&
    value.requestId.length <= 64
  );
}

/**
 * Validates the envelope only. `data` is request-specific, so its shape is
 * checked by the caller that knows which request it sent.
 */
export function isExtensionResponse(
  value: unknown,
): value is ExtensionResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false;
  if (typeof value.requestId !== 'string') return false;

  if (value.ok) return 'data' in value;

  return (
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string' &&
    typeof value.error.retryable === 'boolean'
  );
}

export function isRuntimeStatus(value: unknown): value is RuntimeStatus {
  return (
    isRecord(value) &&
    typeof value.connected === 'boolean' &&
    typeof value.version === 'string'
  );
}

export function isProfilePageStatus(
  value: unknown,
): value is ProfilePageStatus {
  return isRecord(value) && typeof value.supported === 'boolean';
}

export function isJobPageStatus(value: unknown): value is JobPageStatus {
  return isRecord(value) && typeof value.supported === 'boolean';
}

export function isSidePanelToggleResult(
  value: unknown,
): value is SidePanelToggleResult {
  return (
    isRecord(value) && (value.state === 'open' || value.state === 'closed')
  );
}

export { isJobCaptureResult, isProfileCaptureResult };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
