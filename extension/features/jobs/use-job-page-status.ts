import { useEffect } from 'react';
import { usePageStatus } from '@/features/extension/use-page-status';
import { useProposal } from '@/features/proposals/proposal-context';
import { jobService } from '@/services/jobs';

/**
 * Whether the active tab is a supported Upwork job post, for the Match and
 * Draft screens. Both start the same capture, so both are gated the same way
 * the profile analyzer is: no job post in the tab, no start button.
 */
export function useJobPageStatus() {
  const pageStatus = usePageStatus(jobService.getPageStatus);
  const { flow, reset } = useProposal();
  const captureFailed = flow.failedStage === 'capture';

  // A failed capture may mean the tab moved since the last look.
  const refresh = pageStatus.refresh;
  useEffect(() => {
    if (captureFailed) void refresh();
  }, [captureFailed, refresh]);

  // Off a job post, a capture failure has one fix: open a job post. Drop the
  // failure so the screen returns to its gated entry instead of offering a
  // retry that cannot succeed.
  useEffect(() => {
    if (captureFailed && pageStatus.status === 'missing') reset();
  }, [captureFailed, pageStatus.status, reset]);

  return pageStatus;
}
