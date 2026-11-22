import { describe, expect, it } from 'vitest';
import {
  createCaptureJobRequest,
  createCaptureProfileRequest,
  createJobPageStatusRequest,
  createProfilePageStatusRequest,
  createStartProposalDraftRequest,
  createStartProfileAnalysisRequest,
  createToggleSidePanelRequest,
  isExtensionRequest,
  isExtensionResponse,
  isJobCaptureResult,
  isJobPageStatus,
  isProfileCaptureResult,
  isProfilePageStatus,
  isSidePanelToggleResult,
} from './protocol';

describe('extension requests', () => {
  it('recognises every request type the worker handles', () => {
    const toggle = createToggleSidePanelRequest();
    const captureJob = createCaptureJobRequest();
    const capture = createCaptureProfileRequest();
    const jobPageStatus = createJobPageStatusRequest();
    const pageStatus = createProfilePageStatusRequest();
    const startDraft = createStartProposalDraftRequest();
    const startAnalysis = createStartProfileAnalysisRequest();

    expect(toggle.type).toBe('TOGGLE_SIDE_PANEL');
    expect(captureJob.type).toBe('CAPTURE_JOB');
    expect(capture.type).toBe('CAPTURE_PROFILE');
    expect(jobPageStatus.type).toBe('GET_JOB_PAGE_STATUS');
    expect(pageStatus.type).toBe('GET_PROFILE_PAGE_STATUS');
    expect(startDraft.type).toBe('START_PROPOSAL_DRAFT');
    expect(startAnalysis.type).toBe('START_PROFILE_ANALYSIS');
    expect(toggle.v).toBe(1);
    expect(isExtensionRequest(toggle)).toBe(true);
    expect(isExtensionRequest(captureJob)).toBe(true);
    expect(isExtensionRequest(capture)).toBe(true);
    expect(isExtensionRequest(jobPageStatus)).toBe(true);
    expect(isExtensionRequest(pageStatus)).toBe(true);
    expect(isExtensionRequest(startDraft)).toBe(true);
    expect(isExtensionRequest(startAnalysis)).toBe(true);
  });

  it('rejects unknown types and wrong versions', () => {
    expect(
      isExtensionRequest({ requestId: 'abc', type: 'DROP_TABLES', v: 1 }),
    ).toBe(false);
    expect(
      isExtensionRequest({ requestId: 'abc', type: 'TOGGLE_SIDE_PANEL', v: 2 }),
    ).toBe(false);
    expect(isExtensionRequest(null)).toBe(false);
  });

  it('rejects request ids outside the accepted length', () => {
    expect(
      isExtensionRequest({ requestId: '', type: 'TOGGLE_SIDE_PANEL', v: 1 }),
    ).toBe(false);
    expect(
      isExtensionRequest({
        requestId: 'x'.repeat(65),
        type: 'TOGGLE_SIDE_PANEL',
        v: 1,
      }),
    ).toBe(false);
  });
});

describe('extension responses', () => {
  it('accepts both branches of the envelope', () => {
    expect(
      isExtensionResponse({
        data: { state: 'open' },
        ok: true,
        requestId: 'abc',
      }),
    ).toBe(true);
    expect(
      isExtensionResponse({
        error: { code: 'FORBIDDEN', message: 'nope', retryable: false },
        ok: false,
        requestId: 'abc',
      }),
    ).toBe(true);
  });

  it('rejects envelopes missing their correlation id or payload', () => {
    expect(isExtensionResponse({ data: { state: 'open' }, ok: true })).toBe(
      false,
    );
    expect(isExtensionResponse({ ok: true, requestId: 'abc' })).toBe(false);
    expect(isExtensionResponse({ ok: false, requestId: 'abc' })).toBe(false);
    expect(isExtensionResponse(null)).toBe(false);
  });

  it('narrows the side panel payload the launcher acts on', () => {
    expect(isSidePanelToggleResult({ state: 'open' })).toBe(true);
    expect(isSidePanelToggleResult({ state: 'closed' })).toBe(true);
    expect(isSidePanelToggleResult({ state: 'OPEN' })).toBe(false);
    expect(isSidePanelToggleResult({})).toBe(false);
    expect(isSidePanelToggleResult(null)).toBe(false);
  });

  it('validates the URL-only profile page preflight payload', () => {
    expect(isProfilePageStatus({ supported: true })).toBe(true);
    expect(isProfilePageStatus({ supported: false })).toBe(true);
    expect(isProfilePageStatus({ supported: 'yes' })).toBe(false);
    expect(isProfilePageStatus(null)).toBe(false);
  });

  it('validates the URL-only job page preflight payload', () => {
    expect(isJobPageStatus({ supported: true })).toBe(true);
    expect(isJobPageStatus({ supported: false })).toBe(true);
    expect(isJobPageStatus({ supported: 'yes' })).toBe(false);
    expect(isJobPageStatus(null)).toBe(false);
  });

  it('validates job capture payloads before a service uses them', () => {
    const result = {
      snapshot: {
        source: 'upwork-dom',
        capturedAt: '2026-08-23T12:00:00.000Z',
        job: {
          ciphertext: '~0def456',
          url: 'https://www.upwork.com/jobs/~0def456',
          title: 'Synthetic job',
          description: 'Synthetic description',
          engagement: { budgetType: 'unknown' },
          skills: [],
          questions: [],
          client: { paymentVerified: null },
          activity: {},
        },
      },
      truncatedFields: [],
    };

    expect(isJobCaptureResult(result)).toBe(true);
    expect(
      isJobCaptureResult({
        ...result,
        snapshot: {
          ...result.snapshot,
          job: { ...result.snapshot.job, description: undefined },
        },
      }),
    ).toBe(false);
  });

  it('validates capture payloads before the side panel uploads them', () => {
    const result = {
      snapshot: {
        source: 'upwork',
        capturedAt: '2026-08-18T12:00:00.000Z',
        completeness: {
          hasIntroVideo: null,
          hasProfilePhoto: null,
          availabilityBadge: null,
          hoursPerWeek: null,
          avgResponseTime: null,
          idVerified: null,
          verifications: null,
          licenses: null,
          linkedAccounts: null,
        },
        profile: {
          skills: [],
          portfolio: [],
          employment: [],
          education: [],
          certifications: [],
          languages: [],
        },
      },
      truncatedFields: [],
    };

    expect(isProfileCaptureResult(result)).toBe(true);
    expect(
      isProfileCaptureResult({
        ...result,
        snapshot: {
          ...result.snapshot,
          profile: { ...result.snapshot.profile, skills: undefined },
        },
      }),
    ).toBe(false);
  });
});
