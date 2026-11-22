import { describe, expect, it } from 'vitest';
import type { ActivityDay } from '@/lib/api';
import { buildCalendarWeeks } from '@/lib/build-calendar-weeks';

describe('buildCalendarWeeks', () => {
  it('aligns to Monday and zero-fills missing days', () => {
    const weeks = buildCalendarWeeks(
      [{ date: '2026-02-04', drafted: 2, sent: 1, level: 3 }],
      '2026-02-03',
      '2026-02-05',
    );

    expect(weeks[0]?.map(({ date }) => date)).toEqual([
      '2026-02-02',
      '2026-02-03',
      '2026-02-04',
      '2026-02-05',
      '2026-02-06',
      '2026-02-07',
      '2026-02-08',
    ]);
    expect(weeks[0]?.[0]).toEqual({
      date: '2026-02-02',
      drafted: 0,
      sent: 0,
      level: 0,
    });
    expect(weeks[0]?.[2]?.level).toBe(3);
  });

  it('preserves leap day in chronological order', () => {
    const dates = buildCalendarWeeks([], '2024-02-28', '2024-03-01')
      .flat()
      .map(({ date }) => date);

    expect(dates).toContain('2024-02-29');
    expect(dates.indexOf('2024-02-29')).toBe(dates.indexOf('2024-02-28') + 1);
  });

  it('preserves a sparse final-day entry across the twelve-month grid', () => {
    const finalDay: ActivityDay = {
      date: '2026-08-25',
      drafted: 4,
      sent: 2,
      level: 4,
    };
    const weeks = buildCalendarWeeks(
      [finalDay],
      '2025-08-26',
      finalDay.date,
    );

    expect(weeks).toHaveLength(53);
    expect(weeks.flat().find(({ date }) => date === finalDay.date)).toEqual(
      finalDay,
    );
  });
});
