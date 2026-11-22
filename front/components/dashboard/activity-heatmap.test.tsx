import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ActivityHeatmap,
  DASHBOARD_ACTIVITY_WEEKS,
} from '@/components/dashboard/activity-heatmap';
import en from '@/i18n/dictionaries/en';
import fr from '@/i18n/dictionaries/fr';
import type { InsightsActivity } from '@/lib/api';

const activity: InsightsActivity = {
  timeZone: 'Africa/Casablanca',
  from: '2026-08-31',
  to: '2026-09-15',
  days: [
    { date: '2026-09-02', drafted: 3, sent: 1, level: 3 },
    { date: '2026-09-09', drafted: 5, sent: 2, level: 4 },
  ],
  totals: { drafted: 8, sent: 3, activeDays: 2 },
  currentStreakWeeks: 2,
  longestStreakWeeks: 4,
  maxPerDay: 5,
};

describe('ActivityHeatmap', () => {
  it('uses the server level with the same intensity scale as the extension', () => {
    const markup = renderToStaticMarkup(
      <ActivityHeatmap activity={activity} copy={en.dashboard.activity} locale="en" />,
    );

    expect(markup).toContain('data-activity-date="2026-09-02"');
    expect(markup).toContain('data-level="3"');
    expect(markup).toContain('fill-[var(--activity-map-accent)] opacity-70');
    expect(markup).toContain(
      '<title>3 drafted, 1 sent · Sep 2, 2026</title>',
    );
  });

  it('summarises totals as stat tiles with send rate and best streak', () => {
    const markup = renderToStaticMarkup(
      <ActivityHeatmap activity={activity} copy={en.dashboard.activity} locale="en" />,
    );

    expect(markup).toContain('<dt class="text-xs text-muted-foreground">Drafted</dt>');
    expect(markup).toContain('38% of drafts');
    expect(markup).toContain('Best 4 wk');
  });

  it('omits the send rate before anything is drafted', () => {
    const markup = renderToStaticMarkup(
      <ActivityHeatmap
        activity={{ ...activity, totals: { drafted: 0, sent: 0, activeDays: 0 } }}
        copy={en.dashboard.activity}
        locale="en"
      />,
    );

    expect(markup).not.toContain('of drafts');
  });

  it('is fluid and uses contribution-map-sized cells', () => {
    const markup = renderToStaticMarkup(
      <ActivityHeatmap activity={activity} copy={en.dashboard.activity} locale="en" />,
    );
    const svgTag = markup.match(/<svg[^>]*role="img"[^>]*>/)?.[0] ?? '';

    expect(svgTag).toContain('viewBox=');
    expect(svgTag).toContain('w-full');
    expect(svgTag).not.toMatch(/\swidth=/);
    expect(svgTag).not.toMatch(/\sheight=/);
    expect(markup).toContain('width="9"');
  });

  it('keeps all calendar cells and localized labels and tooltips', () => {
    const markup = renderToStaticMarkup(
      <ActivityHeatmap activity={activity} copy={fr.dashboard.activity} locale="fr" />,
    );

    expect(markup.match(/data-activity-date=/g)).toHaveLength(21);
    expect(markup).toContain('>Lun</text>');
    expect(markup).toContain('>Mer</text>');
    expect(markup).toContain('>Ven</text>');
    expect(markup).toContain('2 sept. 2026');
  });

  it('drops a month label when its column would collide with the previous one', () => {
    const markup = renderToStaticMarkup(
      <ActivityHeatmap activity={activity} copy={en.dashboard.activity} locale="en" />,
    );

    expect(markup).toContain('>Aug</text>');
    expect(markup).not.toContain('>Sep</text>');
  });

  it('limits a full API calendar to the latest six months', () => {
    const fullYear: InsightsActivity = {
      ...activity,
      from: '2025-09-01',
      to: '2026-08-31',
      days: [
        { date: '2025-09-01', drafted: 1, sent: 0, level: 1 },
        { date: '2026-08-31', drafted: 2, sent: 1, level: 2 },
      ],
    };
    const markup = renderToStaticMarkup(
      <ActivityHeatmap activity={fullYear} copy={en.dashboard.activity} locale="en" />,
    );

    expect(DASHBOARD_ACTIVITY_WEEKS).toBe(26);
    expect(markup.match(/data-activity-date=/g)).toHaveLength(26 * 7);
    expect(markup).not.toContain('data-activity-date="2025-09-01"');
    expect(markup).toContain('data-activity-date="2026-08-31"');
  });
});
