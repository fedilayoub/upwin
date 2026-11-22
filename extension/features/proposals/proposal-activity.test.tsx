import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ActivityCalendar } from '@/types/insights';
import { ProposalActivityCard } from './proposal-activity';

const activity: ActivityCalendar = {
  timeZone: 'UTC',
  from: '2025-08-26',
  to: '2026-08-25',
  days: [{ date: '2026-08-25', drafted: 2, sent: 1, level: 3 }],
  totals: { drafted: 84, sent: 61, activeDays: 39 },
  currentStreakWeeks: 3,
  longestStreakWeeks: 7,
  maxPerDay: 5,
};

describe('ProposalActivityCard', () => {
  it('renders the last six months of drafting with the year totals', () => {
    const markup = renderToStaticMarkup(
      <ProposalActivityCard activity={activity} />,
    );

    expect(markup).toContain('data-proposal-activity');
    expect(markup).toContain('Proposal activity');
    expect(markup).toContain('6 months');
    expect(markup).toContain('84 drafted in 12 months');
    expect(markup).toContain('3 week streak · best 7');
    // Cells stop growing once readable; the leftover card width goes to the
    // totals column beside the grid.
    expect(markup).toContain('max-w-[420px]');
    expect(markup).toContain(
      '@[480px]:grid-cols-[minmax(252px,420px)_minmax(150px,1fr)]',
    );
    expect(markup).toContain('overflow-x-auto');
    expect(markup).toContain('min-w-[252px]');
  });
});
