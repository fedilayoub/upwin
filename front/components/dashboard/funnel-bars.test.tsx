import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FunnelBars } from '@/components/dashboard/funnel-bars';
import en from '@/i18n/dictionaries/en';

describe('FunnelBars', () => {
  it('renders a non-monotonic step sequence without changing its counts', () => {
    const markup = renderToStaticMarkup(
      <FunnelBars
        copy={en.dashboard.funnel}
        funnel={{
          window: '30d',
          steps: [
            { id: 'jobsAnalyzed', count: 2, share: 1 },
            { id: 'proposalsDrafted', count: 5, share: 2.5 },
            { id: 'sent', count: 3, share: 1.5 },
            { id: 'replied', count: 4, share: 2 },
            { id: 'interviewing', count: 1, share: 0.5 },
            { id: 'hired', count: 2, share: 1 },
          ],
        }}
      />,
    );

    expect(markup).toContain('Projects analyzed');
    expect(markup).toContain('Proposals drafted');
    expect(markup).toContain('>5<');
    expect(markup).toContain('>4<');
    // Printed unclamped: a step above the first one is a real condition.
    expect(markup).toContain('250%');
    // The bar itself clamps so it cannot overflow its track.
    expect(markup).toContain('width:100%');
    expect(markup).not.toContain('width:250%');
  });

  it('renders the share of each step against the first one', () => {
    const markup = renderToStaticMarkup(
      <FunnelBars
        copy={en.dashboard.funnel}
        funnel={{
          window: 'all',
          steps: [
            { id: 'jobsAnalyzed', count: 40, share: 1 },
            { id: 'proposalsDrafted', count: 20, share: 0.5 },
            { id: 'sent', count: 10, share: 0.25 },
            { id: 'replied', count: 5, share: 0.125 },
            { id: 'interviewing', count: 2, share: 0.05 },
            { id: 'hired', count: 1, share: 0.025 },
          ],
        }}
      />,
    );

    expect(markup).toContain('50%');
    expect(markup).toContain('width:25%');
    expect(markup).not.toContain(en.dashboard.funnel.shareEmpty);
  });

  it('shows the empty hint and no bars when the funnel has no shares', () => {
    const markup = renderToStaticMarkup(
      <FunnelBars
        copy={en.dashboard.funnel}
        funnel={{
          window: 'all',
          steps: [
            { id: 'jobsAnalyzed', count: 0, share: null },
            { id: 'proposalsDrafted', count: 0, share: null },
            { id: 'sent', count: 0, share: null },
            { id: 'replied', count: 0, share: null },
            { id: 'interviewing', count: 0, share: null },
            { id: 'hired', count: 0, share: null },
          ],
        }}
      />,
    );

    expect(markup).toContain(en.dashboard.funnel.shareEmpty);
    // A share of 0% would claim a measured drop-off where none was measured.
    expect(markup).not.toContain('0%');
  });
});
