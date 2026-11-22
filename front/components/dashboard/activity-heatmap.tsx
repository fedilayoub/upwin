import type { Dictionary } from '@/i18n/types';
import type { ActivityDay, InsightsActivity } from '@/lib/api';
import { buildCalendarWeeks } from '@/lib/build-calendar-weeks';

const CELL_SIZE = 9;
const CELL_GAP = 3;
const PITCH = CELL_SIZE + CELL_GAP;
const LABEL_WIDTH = 34;
const MONTH_HEIGHT = 16;
const MIN_MONTH_GAP = 3;
const LEVEL_CLASSES: Record<ActivityDay['level'], string> = {
  0: 'fill-muted',
  1: 'fill-[var(--activity-map-accent)] opacity-25',
  2: 'fill-[var(--activity-map-accent)] opacity-45',
  3: 'fill-[var(--activity-map-accent)] opacity-70',
  4: 'fill-[var(--activity-map-accent)]',
};

const HEATMAP_LEVELS = [0, 1, 2, 3, 4] as const;
export const DASHBOARD_ACTIVITY_WEEKS = 26;

export function ActivityHeatmap({
  activity,
  copy,
  locale,
}: {
  activity: InsightsActivity;
  copy: Dictionary['dashboard']['activity'];
  locale: string;
}) {
  const weeks = buildCalendarWeeks(
    activity.days,
    activity.from,
    activity.to,
  ).slice(-DASHBOARD_ACTIVITY_WEEKS);
  const gridWidth = Math.max(0, weeks.length * PITCH - CELL_GAP);
  const gridHeight = 7 * PITCH - CELL_GAP;
  const width = LABEL_WIDTH + gridWidth;
  const height = MONTH_HEIGHT + gridHeight;
  const monthLabels = buildMonthLabels(weeks, activity.from, activity.to, locale);

  return (
    <div className="flex h-full flex-col gap-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden border border-border/70 bg-border/70 sm:grid-cols-4">
        <ActivityStat label={copy.drafted} value={activity.totals.drafted} />
        <ActivityStat
          detail={
            activity.totals.drafted > 0
              ? fill(copy.sendRate, {
                  rate: Math.round((activity.totals.sent / activity.totals.drafted) * 100),
                })
              : undefined
          }
          label={copy.sent}
          value={activity.totals.sent}
        />
        <ActivityStat label={copy.activeDays} value={activity.totals.activeDays} />
        <ActivityStat
          detail={fill(copy.longestStreak, { count: activity.longestStreakWeeks })}
          label={copy.currentStreak}
          unit={copy.weeksUnit}
          value={activity.currentStreakWeeks}
        />
      </dl>
      <div className="flex flex-1 flex-col justify-center gap-4">
        <div className="pb-2">
          {/* The API returns 12 months, but the dashboard shows the latest 26
              weeks so each day remains legible. Slicing the calendar is layout;
              the backend-owned summary totals above remain unchanged. */}
          <svg
            aria-label={copy.title}
            className="block h-auto w-full"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            viewBox={`0 0 ${width} ${height}`}
          >
            {monthLabels.map((label) => (
              <text
                className="fill-muted-foreground text-[8px]"
                key={`${label.month}-${label.x}`}
                x={label.x}
                y={MONTH_HEIGHT - 4}
              >
                {label.month}
              </text>
            ))}
            {copy.weekdays.map((weekday, dayIndex) => (
              <text
                className="fill-muted-foreground text-[8px]"
                key={weekday}
                textAnchor="end"
                x={LABEL_WIDTH - 4}
                y={MONTH_HEIGHT + dayIndex * PITCH + CELL_SIZE - 1}
              >
                {dayIndex % 2 === 0 ? weekday : ''}
              </text>
            ))}
            {weeks.flatMap((week, weekIndex) =>
              week.map((day, dayIndex) => (
                <rect
                  className={LEVEL_CLASSES[day.level]}
                  data-activity-date={day.date}
                  data-level={day.level}
                  height={CELL_SIZE}
                  key={day.date}
                  rx="2"
                  width={CELL_SIZE}
                  x={LABEL_WIDTH + weekIndex * PITCH}
                  y={MONTH_HEIGHT + dayIndex * PITCH}
                >
                  <title>
                    {fill(copy.tooltip, {
                      drafted: day.drafted,
                      sent: day.sent,
                      date: formatCalendarDate(day.date, locale),
                    })}
                  </title>
                </rect>
              )),
            )}
          </svg>
        </div>
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground" aria-label={copy.legend}>
          <span>{copy.less}</span>
          {HEATMAP_LEVELS.map((level) => (
            <svg
              aria-hidden="true"
              className="block"
              height={CELL_SIZE}
              key={level}
              role="presentation"
              viewBox={`0 0 ${CELL_SIZE} ${CELL_SIZE}`}
              width={CELL_SIZE}
            >
              <rect className={LEVEL_CLASSES[level]} height={CELL_SIZE} rx="2" width={CELL_SIZE} />
            </svg>
          ))}
          <span>{copy.more}</span>
        </div>
      </div>
    </div>
  );
}

function ActivityStat({
  detail,
  label,
  unit,
  value,
}: {
  detail?: string;
  label: string;
  unit?: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-1 bg-card px-3.5 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tracking-[-0.03em] tabular-nums">
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>
        ) : null}
      </dd>
      {detail ? (
        <dd className="text-xs text-muted-foreground">{detail}</dd>
      ) : null}
    </div>
  );
}

function buildMonthLabels(
  weeks: ActivityDay[][],
  from: string,
  to: string,
  locale: string,
): Array<{ month: string; x: number }> {
  const seen = new Set<string>();
  const labels: Array<{ month: string; x: number }> = [];
  let previousWeekIndex: number | null = null;

  weeks.forEach((week, weekIndex) => {
    week.forEach((day) => {
      if (day.date < from || day.date > to) return;

      const monthKey = day.date.slice(0, 7);
      if (seen.has(monthKey)) return;
      seen.add(monthKey);

      if (
        previousWeekIndex !== null &&
        weekIndex - previousWeekIndex < MIN_MONTH_GAP
      ) {
        return;
      }

      labels.push({
        month: new Intl.DateTimeFormat(locale, {
          month: 'short',
          timeZone: 'UTC',
        }).format(new Date(`${day.date}T00:00:00.000Z`)),
        x: LABEL_WIDTH + weekIndex * PITCH,
      });
      previousWeekIndex = weekIndex;
    });
  });
  return labels;
}

function formatCalendarDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}
