import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApplicationCardContent } from '@/components/applications/application-card-content';
import en from '@/i18n/dictionaries/en';
import { toApplicationCards } from '@/lib/application-kanban-data';
import type { ProposalOutcomeListItem } from '@/lib/api';

const copy = en.applications.board;

function render(overrides: Partial<ProposalOutcomeListItem> = {}) {
  const [card] = toApplicationCards([
    {
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
    },
  ]);
  return renderToStaticMarkup(
    <ApplicationCardContent card={card!} copy={copy} locale="en" />,
  );
}

describe('ApplicationCardContent', () => {
  it('renders an auto-enrolled card whose sentAt is still null', () => {
    // sentAt is nullable since v2; formatting null yields "Invalid Date".
    const markup = render();
    expect(markup).toContain('Senior React Developer');
    expect(markup).toContain(copy.enrolled);
    expect(markup).not.toContain('Invalid Date');
  });

  it('switches to the sent date once the application was submitted', () => {
    const markup = render({
      status: 'sent',
      sentAt: '2026-08-25T09:00:00.000Z',
    });
    expect(markup).toContain(copy.sent);
    expect(markup).not.toContain(copy.enrolled);
  });

  it('omits connects when none were recorded', () => {
    expect(render()).not.toContain(copy.connects);
    expect(render({ connectsSpent: 12 })).toContain(copy.connects);
  });
});
