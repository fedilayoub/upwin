import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import en from '@/i18n/dictionaries/en';
import type { RecentActivityItem } from '@/lib/api/types';

function render(items: RecentActivityItem[]) {
  return renderToStaticMarkup(
    <RecentActivity
      copy={en.dashboard.recentActivity}
      items={items}
      locale="en"
      outcomeStatuses={en.dashboard.outcomeStatuses}
    />,
  );
}

describe('RecentActivity', () => {
  it('keeps numeric scores visible in a fixed trailing column', () => {
    const markup = render([
      {
        kind: 'job-analysis',
        id: 'analysis-one',
        occurredAt: '2026-09-02T14:44:00.000Z',
        label: 'A very long job title that must not displace the score badge',
        score: 60,
      },
    ]);

    expect(markup).toContain('shrink-0');
    expect(markup).toContain('60/100');
  });

  it('shows an explicit unavailable state for activity kinds without scores', () => {
    const markup = render([
      {
        kind: 'proposal-draft',
        id: 'draft-one',
        occurredAt: '2026-09-02T14:44:00.000Z',
        label: 'Creative front-end developer',
        score: null,
      },
    ]);

    expect(markup).toContain(en.dashboard.recentActivity.notScored);
  });
});
