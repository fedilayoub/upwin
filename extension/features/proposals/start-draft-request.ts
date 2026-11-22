import {
  createErrorResponse,
  type ExtensionResponse,
} from '@/features/extension/protocol';
import { isLauncherSenderUrl } from '@/features/launcher/sender';
import { jobCiphertextFromUrl } from '@/features/upwork/job/url';
import type { ProposalDraftIntent } from './draft-intent';

export interface ProposalDraftRequestSender {
  tab?: { id?: number; windowId: number };
  url?: string;
}

interface ProposalDraftRequestDependencies {
  canOpenPanel: boolean;
  hasOpenPanel: (windowId: number) => boolean;
  openPanel: (tabId: number) => Promise<unknown>;
  setIntent: (intent: ProposalDraftIntent) => Promise<unknown>;
  now?: () => number;
}

export function handleStartProposalDraftRequest(
  requestId: string,
  sender: ProposalDraftRequestSender,
  sendResponse: (response: ExtensionResponse<'START_PROPOSAL_DRAFT'>) => void,
  dependencies: ProposalDraftRequestDependencies,
): true {
  const tab = sender.tab;
  const ciphertext = jobCiphertextFromUrl(sender.url);

  if (
    tab?.id === undefined ||
    !isLauncherSenderUrl(sender.url) ||
    ciphertext === undefined
  ) {
    sendResponse(
      createErrorResponse(
        requestId,
        'FORBIDDEN',
        'The draft request did not come from a supported job page.',
      ),
    );
    return true;
  }

  if (!dependencies.canOpenPanel) {
    sendResponse(
      createErrorResponse(
        requestId,
        'RUNTIME_ERROR',
        'This browser cannot open the side panel.',
      ),
    );
    return true;
  }

  // Deliberately unawaited: sidePanel.open() must stay on the click stack.
  void dependencies
    .setIntent({
      requestedAt: dependencies.now?.() ?? Date.now(),
      ciphertext,
    })
    .catch(() => undefined);

  // This intent never toggles or closes an already-open panel.
  if (!dependencies.hasOpenPanel(tab.windowId)) {
    void dependencies.openPanel(tab.id).catch(() => undefined);
  }

  sendResponse({
    data: { state: 'open' },
    ok: true,
    requestId,
  });
  return true;
}
