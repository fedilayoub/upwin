import { sendExtensionRequest } from '@/features/extension/client';
import {
  createStartProfileAnalysisRequest,
  createStartProposalDraftRequest,
  createToggleSidePanelRequest,
  isSidePanelToggleResult,
  type SidePanelToggleResult,
} from '@/features/extension/protocol';

export const sidePanelService = {
  /** Opens the panel and leaves a one-shot request to draft the current job. */
  startProposalDraft(): Promise<SidePanelToggleResult> {
    return sendExtensionRequest(
      createStartProposalDraftRequest(),
      isSidePanelToggleResult,
    );
  },

  /**
   * Opens the panel and leaves a request for it to analyse this profile. Same
   * gesture rule as `toggle`, and for the same reason.
   */
  startProfileAnalysis(): Promise<SidePanelToggleResult> {
    return sendExtensionRequest(
      createStartProfileAnalysisRequest(),
      isSidePanelToggleResult,
    );
  },

  /**
   * Must be called directly from a user gesture. Chrome only honours
   * `sidePanel.open()` while the originating click is still on the stack, and
   * awaiting anything beforehand discards it.
   */
  toggle(): Promise<SidePanelToggleResult> {
    return sendExtensionRequest(
      createToggleSidePanelRequest(),
      isSidePanelToggleResult,
    );
  },
};
