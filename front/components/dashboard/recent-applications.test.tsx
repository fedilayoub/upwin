import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RecentApplications } from '@/components/dashboard/recent-applications';
import en from '@/i18n/dictionaries/en';
import type { ProposalOutcomeListItem } from '@/lib/api';

function item(
  overrides: Partial<ProposalOutcomeListItem> = {},
): ProposalOutcomeListItem {
  return {
    id: 'outcome-one',
    jobAnalysisId: 'analysis-one',
    jobTitle: 'Responsive product dashboard',
    jobUrl: 'https://example.com/job',
    matchScore: 84,
    status: 'sent',
    connectsSpent: null,
    sentAt: '2026-09-01T10:00:00.000Z',
    respondedAt: null,
    decidedAt: null,
    note: null,
    createdAt: '2026-08-28T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

function render(overrides: Partial<ProposalOutcomeListItem> = {}) {
  return renderToStaticMarkup(
    <RecentApplications
      copy={en.dashboard.applications}
      items={[item(overrides)]}
      locale="en"
      outcomeStatuses={en.dashboard.outcomeStatuses}
      saveOutcomeAction={async () => ({ status: 'idle' })}
    />,
  );
}

describe('RecentApplications', () => {
  it('adds compact field labels for narrow layouts without changing the table data', () => {
    const markup = render();

    expect(markup).toContain('table-fixed');
    expect(markup).toContain('max-lg:grid');
    expect(markup).toContain(`data-label="${en.dashboard.applications.job}"`);
    expect(markup).toContain(`data-label="${en.dashboard.applications.status}"`);
    expect(markup).toContain('Responsive product dashboard');
    expect(markup).not.toContain('—');
  });

  it('saves status on change without a save button or connects column', () => {
    const markup = render();

    expect(markup).toContain('appearance-none');
    expect(markup).not.toContain('type="submit"');
    expect(markup).not.toContain('>Connects<');
  });

  it('renders an auto-enrolled row whose sentAt is still null', () => {
    // Drafting now enrols a job at in-progress with no sentAt. Formatting that
    // null threw "Invalid time value" and took the whole dashboard down.
    const markup = render({ status: 'in-progress', sentAt: null });

    expect(markup).toContain('Responsive product dashboard');
    expect(markup).not.toContain('Invalid Date');
  });
});
