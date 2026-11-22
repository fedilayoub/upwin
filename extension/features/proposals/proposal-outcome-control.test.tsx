import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/connection/connection-context', () => ({
  useConnection: () => ({ getToken: vi.fn() }),
}));

import { ProposalOutcomeControl } from './proposal-screen';

const ANALYSIS_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa11';

function render() {
  return renderToStaticMarkup(
    <ProposalOutcomeControl analysisId={ANALYSIS_ID} />,
  );
}

describe('ProposalOutcomeControl', () => {
  it('offers "Mark as applied" as the primary action on a fresh draft', () => {
    // Drafting enrols the job at `in-progress`, so the one thing the user has
    // to tell us next is whether they actually submitted it.
    const markup = render();
    expect(markup).toContain('Did you apply?');
    expect(markup).toContain('Mark as applied');
  });

  it('explains that the job is already tracked, so nothing is added by hand', () => {
    expect(render()).toContain('already on your tracker');
  });

  it('exposes no status picker; the board owns the rest of the pipeline', () => {
    // The panel offers the one transition the user can confirm from here.
    // Every later status is set on the web tracker, not in the side panel.
    const markup = render();
    expect(markup).not.toContain('aria-pressed');
    for (const label of [
      'In progress',
      'Viewed',
      'Messaged',
      'Interviewing',
      'Hired',
      'Declined',
      'No reply',
    ]) {
      expect(markup).not.toContain(label);
    }
    // The wire value must never surface as a label.
    expect(markup).not.toContain('>Sent<');
  });
});
