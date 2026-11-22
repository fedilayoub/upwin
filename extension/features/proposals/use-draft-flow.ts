import { useCallback, useState } from 'react';
import { useAsyncAction } from '@/hooks/use-async-action';
import { jobService } from '@/services/jobs';
import { proposalService } from '@/services/proposals';
import { getErrorCode, type TokenProvider } from '@/services/api';
import type {
  JobAnalysis,
  JobCaptureResult,
  JobSnapshot,
  JobSnapshotReceipt,
} from '@/types/job';
import type { Proposal } from '@/types/proposal';

export type DraftFlowStage = 'capture' | 'persist' | 'analysis' | 'draft';

export const DRAFT_FLOW_STAGE_LABELS: Record<DraftFlowStage, string> = {
  capture: 'Capturing this job',
  persist: 'Saving the job snapshot',
  analysis: 'Analyzing your match',
  draft: 'Writing your proposal',
};

export interface DraftFlowState {
  capture: JobCaptureResult | null;
  receipt: JobSnapshotReceipt | null;
  analysis: JobAnalysis | null;
  draft: Proposal | null;
  errorCode: string | null;
  stage: DraftFlowStage | null;
  failedStage: DraftFlowStage | null;
}

export interface DraftFlowDependencies {
  capture: () => Promise<JobCaptureResult>;
  persist: (snapshot: JobSnapshot) => Promise<JobSnapshotReceipt>;
  analyze: (snapshot: JobSnapshot) => Promise<JobAnalysis>;
  draft: (analysisId: string) => Promise<Proposal>;
}

export const EMPTY_DRAFT_FLOW_STATE: DraftFlowState = {
  capture: null,
  receipt: null,
  analysis: null,
  draft: null,
  errorCode: null,
  stage: null,
  failedStage: null,
};

export async function runDraftFlow(
  dependencies: DraftFlowDependencies,
  initialState: DraftFlowState,
  startAt: DraftFlowStage,
  onUpdate: (state: DraftFlowState) => void,
  expectedCiphertext?: string,
): Promise<DraftFlowState> {
  let state = initialState;

  const update = (patch: Partial<DraftFlowState>) => {
    state = { ...state, ...patch };
    onUpdate(state);
  };

  const perform = async <T,>(
    stage: DraftFlowStage,
    action: () => Promise<T>,
  ): Promise<T> => {
    update({ errorCode: null, stage, failedStage: null });
    try {
      return await action();
    } catch (error: unknown) {
      update({
        errorCode: getErrorCode(error),
        stage: null,
        failedStage: stage,
      });
      throw error;
    }
  };

  const draftStep = async (
    analysis: JobAnalysis,
    capture: JobCaptureResult,
  ): Promise<DraftFlowState> => {
    const draft = await perform('draft', async () => {
      const result = await dependencies.draft(analysis.id);
      assertDraftMatchesCapture(result, capture);
      return result;
    });
    update({ draft, errorCode: null, stage: null, failedStage: null });
    return state;
  };

  const analysisStep = async (
    capture: JobCaptureResult,
    receipt: JobSnapshotReceipt,
  ): Promise<DraftFlowState> => {
    const analysis = await perform('analysis', async () => {
      const result = await dependencies.analyze(capture.snapshot);
      if (result.jobSnapshotId !== receipt.id) {
        throw new Error(
          'The backend returned a match for another job snapshot.',
        );
      }
      return result;
    });
    update({ analysis });
    return draftStep(analysis, capture);
  };

  const persistStep = async (
    capture: JobCaptureResult,
  ): Promise<DraftFlowState> => {
    const receipt = await perform('persist', async () => {
      const result = await dependencies.persist(capture.snapshot);
      if (
        result.ciphertext !== capture.snapshot.job.ciphertext ||
        result.capturedAt !== capture.snapshot.capturedAt
      ) {
        throw new Error(
          'The backend returned a receipt for another job snapshot.',
        );
      }
      return result;
    });
    update({ receipt });
    return analysisStep(capture, receipt);
  };

  const captureStep = async (): Promise<DraftFlowState> => {
    const capture = await perform('capture', dependencies.capture);
    if (
      expectedCiphertext !== undefined &&
      capture.snapshot.job.ciphertext !== expectedCiphertext
    ) {
      update({ errorCode: null, stage: null, failedStage: 'capture' });
      throw new Error(
        'The active job changed before it could be captured. Return to the job and try again.',
      );
    }
    update({ capture });
    return persistStep(capture);
  };

  switch (startAt) {
    case 'capture':
      return captureStep();
    case 'persist':
      if (!state.capture) throw missingPrerequisite('captured job');
      return persistStep(state.capture);
    case 'analysis':
      if (!state.capture || !state.receipt) {
        throw missingPrerequisite('persisted job snapshot');
      }
      return analysisStep(state.capture, state.receipt);
    case 'draft':
      if (!state.capture || !state.analysis) {
        throw missingPrerequisite('job analysis');
      }
      return draftStep(state.analysis, state.capture);
  }
}

export function useDraftFlow(getToken: TokenProvider) {
  const [flow, setFlow] = useState<DraftFlowState>(EMPTY_DRAFT_FLOW_STATE);

  const executeFlow = useCallback(
    (
      startAt: DraftFlowStage,
      initialState: DraftFlowState,
      expectedCiphertext?: string,
    ) =>
      runDraftFlow(
        {
          capture: jobService.capture,
          persist: (snapshot) => jobService.persist(snapshot, getToken),
          analyze: (snapshot) => jobService.analyze(snapshot, getToken),
          draft: (analysisId) =>
            proposalService.generateDraft(analysisId, getToken),
        },
        initialState,
        startAt,
        setFlow,
        expectedCiphertext,
      ),
    [getToken],
  );
  const action = useAsyncAction(executeFlow);

  const start = useCallback(
    (expectedCiphertext?: string) => {
      const initialState = { ...EMPTY_DRAFT_FLOW_STATE };
      setFlow(initialState);
      action.reset();
      return action.execute('capture', initialState, expectedCiphertext);
    },
    [action.execute, action.reset],
  );

  const retry = useCallback(() => {
    if (!flow.failedStage) return Promise.resolve(null);
    return action.execute(flow.failedStage, flow);
  }, [action.execute, flow]);

  const reset = useCallback(() => {
    setFlow(EMPTY_DRAFT_FLOW_STATE);
    action.reset();
  }, [action.reset]);

  const applyDraft = useCallback((draft: Proposal) => {
    setFlow((current) => ({ ...current, draft }));
  }, []);

  return {
    ...flow,
    applyDraft,
    error: action.error,
    errorCode: flow.errorCode ?? action.errorCode,
    failure: action.failure,
    reset,
    retry,
    start,
    status: action.status,
  };
}

function missingPrerequisite(name: string): Error {
  return new Error(`The draft flow is missing its ${name}. Start again.`);
}

function assertDraftMatchesCapture(
  draft: Proposal,
  capture: JobCaptureResult,
): void {
  const questions = capture.snapshot.job.questions;
  const matches =
    draft.answers.length === questions.length &&
    draft.answers.every((answer, index) => {
      const question = questions[index];
      return (
        question !== undefined &&
        answer.position === question.position &&
        answer.blockId === `answer:${question.position}` &&
        answer.question === question.question
      );
    });

  if (!matches) {
    throw new Error(
      'The backend returned screening answers that do not match this job.',
    );
  }
}
