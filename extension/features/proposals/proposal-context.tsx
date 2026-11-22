import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useConnection } from '@/features/connection/connection-context';
import { getErrorCode } from '@/services/api';
import { proposalService } from '@/services/proposals';
import type {
  Proposal,
  ProposalBlockId,
  ProposalRefinement,
} from '@/types/proposal';
import type { ProposalDraftIntent } from './draft-intent';
import { useDraftFlow } from './use-draft-flow';

export interface BlockFeedback {
  message: string | null;
  status: 'idle' | 'copied' | 'error';
}

export interface RefinementErrorDetails {
  message: string;
  code: string | null;
}

interface ProposalContextValue {
  blockText: (blockId: ProposalBlockId) => string;
  copyBlock: (blockId: ProposalBlockId) => Promise<void>;
  copyFeedback: (blockId: ProposalBlockId) => BlockFeedback;
  flow: ReturnType<typeof useDraftFlow>;
  isRefining: (
    blockId: ProposalBlockId,
    refinement: ProposalRefinement,
  ) => boolean;
  refinementPending: boolean;
  refinementError: (
    blockId: ProposalBlockId,
  ) => RefinementErrorDetails | null;
  refineBlock: (
    blockId: ProposalBlockId,
    refinement: ProposalRefinement,
  ) => Promise<void>;
  /** Drops a failed run so the screens return to their entry state. */
  reset: () => void;
  retry: () => Promise<void>;
  setBlockText: (blockId: ProposalBlockId, text: string) => void;
  start: (expectedCiphertext?: string) => Promise<void>;
}

const ProposalContext = createContext<ProposalContextValue | null>(null);

export function ProposalProvider({
  autoDraftIntent = null,
  children,
}: {
  autoDraftIntent?: ProposalDraftIntent | null;
  children: ReactNode;
}) {
  const { getToken } = useConnection();
  const flow = useDraftFlow(getToken);
  const [blockTexts, setBlockTexts] = useState<
    Partial<Record<ProposalBlockId, string>>
  >({});
  const [activeRefinement, setActiveRefinement] = useState<{
    blockId: ProposalBlockId;
    refinement: ProposalRefinement;
  } | null>(null);
  const [refinementErrors, setRefinementErrors] = useState<
    Partial<Record<ProposalBlockId, RefinementErrorDetails>>
  >({});
  const [copyFeedbackByBlock, setCopyFeedbackByBlock] = useState<
    Partial<Record<ProposalBlockId, BlockFeedback>>
  >({});

  const hydrateDraft = useCallback((draft: Proposal) => {
    setBlockTexts(textsFromDraft(draft));
    setRefinementErrors({});
    setCopyFeedbackByBlock({});
  }, []);

  const start = useCallback(
    async (expectedCiphertext?: string) => {
      setBlockTexts({});
      setRefinementErrors({});
      setCopyFeedbackByBlock({});
      const result = await flow.start(expectedCiphertext);
      if (result?.draft) hydrateDraft(result.draft);
    },
    [flow.start, hydrateDraft],
  );

  const retry = useCallback(async () => {
    const result = await flow.retry();
    if (result?.draft) hydrateDraft(result.draft);
  }, [flow.retry, hydrateDraft]);

  const handledDraftRequestRef = useRef<number | null>(null);
  useEffect(() => {
    if (!autoDraftIntent) return;
    if (handledDraftRequestRef.current === autoDraftIntent.requestedAt) return;
    if (flow.stage !== null) return;

    handledDraftRequestRef.current = autoDraftIntent.requestedAt;
    void start(autoDraftIntent.ciphertext);
  }, [autoDraftIntent, flow.stage, start]);

  const blockText = useCallback(
    (blockId: ProposalBlockId): string =>
      blockTexts[blockId] ?? textForBlock(flow.draft, blockId) ?? '',
    [blockTexts, flow.draft],
  );

  const setBlockText = useCallback((blockId: ProposalBlockId, text: string) => {
    setBlockTexts((current) => ({ ...current, [blockId]: text }));
    setCopyFeedbackByBlock((current) => ({
      ...current,
      [blockId]: { message: null, status: 'idle' },
    }));
  }, []);

  const refineBlock = useCallback(
    async (blockId: ProposalBlockId, refinement: ProposalRefinement) => {
      if (!flow.analysis || !flow.draft || activeRefinement) return;

      setActiveRefinement({ blockId, refinement });
      setRefinementErrors((current) => ({
        ...current,
        [blockId]: undefined,
      }));

      try {
        const nextDraft = await proposalService.refine(
          flow.analysis.id,
          blockId,
          refinement,
          getToken,
        );
        flow.applyDraft(nextDraft);
        setBlockTexts((current) =>
          mergeRefinedDraftTexts(current, nextDraft, blockId),
        );
      } catch (error: unknown) {
        setRefinementErrors((current) => ({
          ...current,
          [blockId]: {
            message:
              error instanceof Error
                ? error.message
                : 'Unable to refine this draft block.',
            code: getErrorCode(error),
          },
        }));
      } finally {
        setActiveRefinement(null);
      }
    },
    [activeRefinement, flow, getToken],
  );

  const copyBlock = useCallback(
    async (blockId: ProposalBlockId) => {
      if (!flow.draft) return;
      const text = blockText(blockId);
      setCopyFeedbackByBlock((current) => ({
        ...current,
        [blockId]: { message: null, status: 'idle' },
      }));

      const writeText = globalThis.navigator?.clipboard?.writeText;
      const feedback = await copyDraftText(
        text,
        writeText
          ? (value) => writeText.call(globalThis.navigator.clipboard, value)
          : () => Promise.reject(new Error('Clipboard access is unavailable.')),
      );
      setCopyFeedbackByBlock((current) => ({
        ...current,
        [blockId]: feedback,
      }));
      if (feedback.status === 'error') return;

      try {
        const nextDraft = await proposalService.markBlock(
          flow.draft.id,
          blockId,
          'copied',
          getToken,
        );
        flow.applyDraft(nextDraft);
      } catch {
        setCopyFeedbackByBlock((current) => ({
          ...current,
          [blockId]: {
            message: 'Copied, but we could not save the copied status.',
            status: 'copied',
          },
        }));
      }
    },
    [blockText, flow, getToken],
  );

  const value = useMemo<ProposalContextValue>(
    () => ({
      blockText,
      copyBlock,
      copyFeedback: (blockId) =>
        copyFeedbackByBlock[blockId] ?? { message: null, status: 'idle' },
      flow,
      isRefining: (blockId, refinement) =>
        activeRefinement?.blockId === blockId &&
        activeRefinement.refinement === refinement,
      refinementPending: activeRefinement !== null,
      refinementError: (blockId) => refinementErrors[blockId] ?? null,
      refineBlock,
      reset: flow.reset,
      retry,
      setBlockText,
      start,
    }),
    [
      activeRefinement,
      blockText,
      copyBlock,
      copyFeedbackByBlock,
      flow,
      flow.reset,
      refineBlock,
      refinementErrors,
      retry,
      setBlockText,
      start,
    ],
  );

  return (
    <ProposalContext.Provider value={value}>
      {children}
    </ProposalContext.Provider>
  );
}

export function useProposal(): ProposalContextValue {
  const context = useContext(ProposalContext);
  if (!context) {
    throw new Error('useProposal must be used within a ProposalProvider.');
  }
  return context;
}

export function textsFromDraft(
  draft: Proposal,
): Partial<Record<ProposalBlockId, string>> {
  return Object.fromEntries([
    [draft.proposal.blockId, draft.proposal.text],
    ...draft.answers.map((answer) => [answer.blockId, answer.text]),
  ]) as Partial<Record<ProposalBlockId, string>>;
}

export function mergeRefinedDraftTexts(
  current: Partial<Record<ProposalBlockId, string>>,
  nextDraft: Proposal,
  refinedBlockId: ProposalBlockId,
): Partial<Record<ProposalBlockId, string>> {
  return {
    ...current,
    [refinedBlockId]: textForBlock(nextDraft, refinedBlockId) ?? '',
  };
}

export async function copyDraftText(
  text: string,
  writeText: (value: string) => Promise<void>,
): Promise<BlockFeedback> {
  try {
    await writeText(text);
    return { message: 'Copied to clipboard.', status: 'copied' };
  } catch {
    return {
      message:
        'Copy failed. Select the text and copy it manually, then try again.',
      status: 'error',
    };
  }
}

function textForBlock(
  draft: Proposal | null,
  blockId: ProposalBlockId,
): string | undefined {
  if (!draft) return undefined;
  if (blockId === 'proposal') return draft.proposal.text;
  return draft.answers.find((answer) => answer.blockId === blockId)?.text;
}
