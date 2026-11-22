import type { ActivityDay } from '@/lib/api';

const DAY_MS = 24 * 60 * 60 * 1_000;

export function buildCalendarWeeks(
  days: ActivityDay[],
  from: string,
  to: string,
): ActivityDay[][] {
  const first = parseCalendarDate(from);
  const last = parseCalendarDate(to);
  if (first.getTime() > last.getTime()) return [];

  const firstMonday = addDays(first, -mondayIndex(first));
  const lastSunday = addDays(last, 6 - mondayIndex(last));
  const sparseDays = new Map(days.map((day) => [day.date, day]));
  const weeks: ActivityDay[][] = [];

  for (
    let weekStart = firstMonday;
    weekStart.getTime() <= lastSunday.getTime();
    weekStart = addDays(weekStart, 7)
  ) {
    weeks.push(
      Array.from({ length: 7 }, (_, dayIndex) => {
        const date = formatCalendarDate(addDays(weekStart, dayIndex));
        return (
          sparseDays.get(date) ?? {
            date,
            drafted: 0,
            sent: 0,
            level: 0,
          }
        );
      }),
    );
  }

  return weeks;
}

function parseCalendarDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, count: number): Date {
  return new Date(date.getTime() + count * DAY_MS);
}

function mondayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}
