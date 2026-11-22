import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ActivityDay } from '@/types/insights';
import { ActivityHeatmap, ActivityLegend } from './activity-heatmap';

/** Seven consecutive real dates from the given day. Rolls over month ends. */
function week(startDay: number, month = 8): ActivityDay[] {
  const start = Date.UTC(2026, month - 1, startDay);
  return Array.from({ length: 7 }, (_, index) => ({
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    drafted: 0,
    sent: 0,
    level: 0 as ActivityDay['level'],
  }));
}

const sampleWeek: ActivityDay[] = [
  { date: '2026-08-10', drafted: 0, sent: 0, level: 0 },
  { date: '2026-08-11', drafted: 1, sent: 0, level: 1 },
  { date: '2026-08-12', drafted: 3, sent: 1, level: 3 },
  { date: '2026-08-13', drafted: 0, sent: 0, level: 0 },
  { date: '2026-08-14', drafted: 0, sent: 0, level: 0 },
  { date: '2026-08-15', drafted: 0, sent: 0, level: 0 },
  { date: '2026-08-16', drafted: 0, sent: 0, level: 0 },
];

describe('ActivityHeatmap', () => {
  it('renders every cell with native tooltip text and server-provided level class', () => {
    const markup = renderToStaticMarkup(
      <ActivityHeatmap weeks={[sampleWeek]} />,
    );

    expect(markup).toContain(
      '<title>3 proposals drafted, 1 sent · 12 Aug 2026</title>',
    );
    expect(markup).toContain('data-level="3"');
    expect(markup).toContain('fill-primary/70');
    // Default cell size is the familiar contribution-graph 9px.
    expect(markup).toContain('width="9"');
  });

  it('labels weekdays and does not mistake a label for a cell', () => {
    const markup = renderToStaticMarkup(
      <ActivityHeatmap weeks={[sampleWeek]} />,
    );

    // Seven day cells, and the weekday letters are text, not extra rects.
    expect(markup.match(/<rect/g)).toHaveLength(7);
    expect(markup).toContain('>M</text>');
    expect(markup).toContain('>W</text>');
    expect(markup).toContain('>F</text>');
  });

  it('labels a month once, on the week it starts', () => {
    // Three weeks of August then September — far enough apart to clear the
    // minimum label gap, which the next test covers separately.
    const weeks = [week(3), week(10), week(17), week(1, 9)];
    const markup = renderToStaticMarkup(<ActivityHeatmap weeks={weeks} />);

    expect(markup.match(/>Aug</g)).toHaveLength(1);
    // Exactly "Sep": en-GB would render "Sept" here, the only four-character
    // short month and the widest axis label.
    expect(markup).toContain('>Sep</text>');
    expect(markup).not.toContain('>Sept<');
  });

  it('skips a month label that would collide with the previous one', () => {
    // Sep starts one column after Aug — closer than the minimum clearance, so
    // it is dropped rather than overlapped.
    const weeks = [week(31, 8), week(1, 9), week(8, 9)];
    const markup = renderToStaticMarkup(<ActivityHeatmap weeks={weeks} />);

    expect(markup.match(/>Aug</g)).toHaveLength(1);
    expect(markup).not.toContain('>Sep<');
  });

  it('scales the grid with cellSize and gap', () => {
    const markup = renderToStaticMarkup(
      <ActivityHeatmap cellSize={12} gap={4} weeks={[sampleWeek]} />,
    );

    expect(markup).toContain('width="12"');
  });

  it('is fluid: sized by viewBox, not by fixed pixel attributes', () => {
    const markup = renderToStaticMarkup(
      <ActivityHeatmap weeks={[sampleWeek]} />,
    );
    const svgTag = markup.match(/<svg[^>]*>/)?.[0] ?? '';

    expect(svgTag).toContain('viewBox=');
    expect(svgTag).toContain('w-full');
    // A width or height attribute on the root would pin it and reintroduce the
    // gap on a wider panel; the viewBox alone must set the aspect ratio.
    expect(svgTag).not.toMatch(/\swidth=/);
    expect(svgTag).not.toMatch(/\sheight=/);
  });

  it('renders an empty calendar without throwing', () => {
    const markup = renderToStaticMarkup(<ActivityHeatmap weeks={[]} />);

    expect(markup).not.toContain('<rect');
    expect(markup).toContain('</svg>');
  });
});

describe('ActivityLegend', () => {
  it('renders one swatch per level, least to most', () => {
    const markup = renderToStaticMarkup(<ActivityLegend />);

    expect(markup.match(/<rect/g)).toHaveLength(5);
    expect(markup).toContain('Less');
    expect(markup).toContain('More');
    expect(markup.indexOf('fill-muted')).toBeLessThan(
      markup.indexOf('fill-primary"'),
    );
  });
});
