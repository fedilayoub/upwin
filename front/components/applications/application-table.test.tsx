import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApplicationTable } from '@/components/applications/application-table';
import { ApplicationViewToggle } from '@/components/applications/application-view-toggle';
import en from '@/i18n/dictionaries/en';
import { toApplicationCards } from '@/lib/application-kanban-data';
import type { ProposalOutcomeListItem } from '@/lib/api';

function item(
  overrides: Partial<ProposalOutcomeListItem> = {},
): ProposalOutcomeListItem {
  return {
    id: 'outcome-1',
    jobAnalysisId: 'analysis-1',
    jobTitle: 'Senior React Developer',
    jobUrl: 'https://www.upwork.com/jobs/~021',
    matchScore: 91,
    status: 'in-progress',
    connectsSpent: null,
    sentAt: null,
    respondedAt: null,
    decidedAt: null,
    note: null,
    createdAt: '2026-08-20T09:00:00.000Z',
    updatedAt: '2026-08-20T09:00:00.000Z',
    ...overrides,
  };
}

function renderTable(items: ProposalOutcomeListItem[]) {
  return renderToStaticMarkup(
    <ApplicationTable
      cards={toApplicationCards(items)}
      copy={en.applications}
      locale="en"
      moveApplication={async () => ({ status: 'idle' })}
      statusLabels={en.dashboard.outcomeStatuses}
    />,
  );
}

describe('ApplicationTable', () => {
  it('lists every card newest first with its status selected', () => {
    const markup = renderTable([
      item({ id: 'old', jobTitle: 'Older project' }),
      item({
        id: 'new',
        jobTitle: 'Newer project',
        status: 'sent',
        sentAt: '2026-09-03T10:00:00.000Z',
        createdAt: '2026-09-02T10:00:00.000Z',
      }),
    ]);

    expect(markup.indexOf('Newer project')).toBeLessThan(
      markup.indexOf('Older project'),
    );
    expect(markup).toContain('<option value="sent" selected="">');
    expect(markup).toContain(`${en.applications.board.sent}</span> Sep 3, 2026`);
  });

  it('labels an unsent card by its drafted date instead of formatting null', () => {
    const markup = renderTable([item()]);

    expect(markup).toContain(`${en.applications.board.enrolled}</span> Aug 20, 2026`);
    expect(markup).not.toContain('Invalid Date');
  });
});

describe('ApplicationViewToggle', () => {
  it('marks the current view and links to both', () => {
    const markup = renderToStaticMarkup(
      <ApplicationViewToggle
        copy={en.applications.view}
        current="table"
        hrefFor={{
          board: '/en/applications?window=30d&view=board',
          table: '/en/applications?window=30d&view=table',
        }}
      />,
    );

    expect(markup).toContain('href="/en/applications?window=30d&amp;view=board"');
    expect(markup).toMatch(/aria-current="page"[^>]*href="[^"]*view=table"/);
  });
});
