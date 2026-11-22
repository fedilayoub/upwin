import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationStatsBar } from '@/components/applications/application-stats';
import { ApplicationsEmptyState } from '@/components/applications/applications-empty-state';
import en from '@/i18n/dictionaries/en';
import type { ApplicationStats } from '@/lib/api';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const copy = en.applications;

function stats(overrides: Partial<ApplicationStats> = {}): ApplicationStats {
  return {
    window: '30d',
    from: '2026-08-03T00:00:00.000Z',
    to: '2026-09-02T12:00:00.000Z',
    total: 0,
    applied: 0,
    counts: {
      'in-progress': 0,
      sent: 0,
      viewed: 0,
      messaged: 0,
      interviewing: 0,
      hired: 0,
      declined: 0,
      'no-response': 0,
    },
    ...overrides,
  };
}

describe('ApplicationStatsBar', () => {
  it('renders applied from the server field, not the sum of counts', () => {
    // `applied` filters sentAt while `counts` partitions createdAt, so the two
    // legitimately disagree. Summing counts here would be wrong, not just
    // redundant.
    const markup = renderToStaticMarkup(
      <ApplicationStatsBar
        copy={copy.stats}
        locale="en"
        stats={stats({
          total: 10,
          applied: 31,
          counts: { ...stats().counts, 'in-progress': 10 },
        })}
      />,
    );
    expect(markup).toContain('>31<');
  });

  it('renders zeros for an account with no movement', () => {
    const markup = renderToStaticMarkup(
      <ApplicationStatsBar copy={copy.stats} locale="en" stats={stats()} />,
    );
    expect(markup).toContain(copy.stats.applied);
    expect(markup).not.toContain('NaN');
  });

  it('marks the active window and keeps every period available', () => {
    const markup = renderToStaticMarkup(
      <ApplicationStatsBar
        copy={copy.stats}
        locale="en"
        stats={stats({ window: '90d' })}
      />,
    );
    expect(markup).toMatch(/aria-checked="true"[^>]*>.*?90 days/);
    expect(markup).toContain('name="window"');
    expect(markup).toContain('value="90d"');
    expect(markup).toContain(copy.stats.windows.all);
  });
});

describe('ApplicationsEmptyState', () => {
  it('explains that drafting enrols a job rather than showing empty lanes', () => {
    const markup = renderToStaticMarkup(
      <ApplicationsEmptyState copy={copy.empty} />,
    );
    expect(markup).toContain(copy.empty.title);
    expect(markup).toContain('automatically');
  });
});
