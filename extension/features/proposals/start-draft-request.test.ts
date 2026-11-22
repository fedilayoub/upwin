import { describe, expect, it, vi } from 'vitest';
import { handleStartProposalDraftRequest } from './start-draft-request';

const sender = {
  tab: { id: 42, windowId: 7 },
  url: 'https://www.upwork.com/jobs/~0def456',
};

describe('START_PROPOSAL_DRAFT worker handling', () => {
  it('forbids a request from a non-launcher sender', () => {
    const sendResponse = vi.fn();
    const dependencies = createDependencies();

    handleStartProposalDraftRequest(
      'request-1',
      { tab: sender.tab, url: 'chrome-extension://abc/sidepanel.html' },
      sendResponse,
      dependencies,
    );

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'FORBIDDEN' }),
        ok: false,
      }),
    );
    expect(dependencies.setIntent).not.toHaveBeenCalled();
    expect(dependencies.openPanel).not.toHaveBeenCalled();
  });

  it('never toggles an already-open panel closed', () => {
    const sendResponse = vi.fn();
    const dependencies = createDependencies();
    dependencies.hasOpenPanel.mockReturnValue(true);

    handleStartProposalDraftRequest(
      'request-2',
      sender,
      sendResponse,
      dependencies,
    );

    expect(dependencies.openPanel).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      data: { state: 'open' },
      ok: true,
      requestId: 'request-2',
    });
  });

  it('answers synchronously without awaiting the intent write', () => {
    const sendResponse = vi.fn();
    const intentWrite = new Promise<never>(() => undefined);
    const dependencies = createDependencies();
    dependencies.setIntent.mockReturnValue(intentWrite);

    handleStartProposalDraftRequest(
      'request-3',
      sender,
      sendResponse,
      dependencies,
    );

    expect(dependencies.setIntent).toHaveBeenCalledWith({
      requestedAt: 1_800_000_000_000,
      ciphertext: '~0def456',
    });
    expect(dependencies.openPanel).toHaveBeenCalledWith(42);
    expect(sendResponse).toHaveBeenCalledOnce();
  });
});

function createDependencies() {
  return {
    canOpenPanel: true,
    hasOpenPanel: vi.fn().mockReturnValue(false),
    openPanel: vi.fn().mockResolvedValue(undefined),
    setIntent: vi.fn().mockResolvedValue(undefined),
    now: () => 1_800_000_000_000,
  };
}
