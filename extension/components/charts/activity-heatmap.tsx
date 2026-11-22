import { cn } from '@/lib/utils';
import { useI18n, type Translate } from '@/features/i18n/i18n-context';
import type { Locale } from '@/features/i18n/locale';
import type { ActivityDay } from '@/types/insights';

const LEVEL_CLASSES: Record<ActivityDay['level'], string> = {
  0: 'fill-muted',
  1: 'fill-primary/25',
  2: 'fill-primary/45',
  3: 'fill-primary/70',
  4: 'fill-primary',
};

export const HEATMAP_LEVELS = [0, 1, 2, 3, 4] as const;

/** Weekday row labels. `buildCalendarWeeks` is Monday-aligned, so index 0 is Monday. */
const WEEKDAY_LABELS: Record<number, string> = { 0: 'M', 2: 'W', 4: 'F' };

const LABEL_GUTTER = 16;
const LABEL_GAP = 4;
const MONTH_ROW = 13;
/** A month label needs this many columns of clearance, or it collides with the previous one. */
const MIN_MONTH_GAP = 3;

export function ActivityHeatmap({
  cellSize = 9,
  className,
  gap = 3,
  weeks,
}: {
  cellSize?: number;
  className?: string;
  gap?: number;
  weeks: ActivityDay[][];
}) {
  const { locale, t } = useI18n();
  const pitch = cellSize + gap;
  const gridWidth = Math.max(0, weeks.length * pitch - gap);
  const gridHeight = 7 * pitch - gap;
  const gridLeft = LABEL_GUTTER + LABEL_GAP;
  const width = gridLeft + gridWidth;
  const height = MONTH_ROW + gridHeight;
  const months = monthLabels(weeks, locale);

  return (
    // Fluid: no width/height attributes, so the viewBox sets the intrinsic
    // aspect ratio and `w-full h-auto` scales the whole grid to its container.
    // Everything inside is in user units, so cells stay square and the labels
    // scale with them. The side panel is user-resizable, so a fixed pixel width
    // would either leave a gap or clip.
    <svg
      aria-label={t('activity.aria', { count: weeks.length })}
      className={cn('block h-auto w-full', className)}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      {months.map((month) => (
        <text
          className="fill-muted-foreground text-[8px]"
          key={month.label + String(month.weekIndex)}
          x={gridLeft + month.weekIndex * pitch}
          y={MONTH_ROW - 4}
        >
          {month.label}
        </text>
      ))}

      {Object.entries(WEEKDAY_LABELS).map(([dayIndex, label]) => (
        <text
          className="fill-muted-foreground text-[8px]"
          key={label}
          textAnchor="end"
          x={LABEL_GUTTER}
          y={MONTH_ROW + Number(dayIndex) * pitch + cellSize - 1}
        >
          {label}
        </text>
      ))}

      {weeks.flatMap((week, weekIndex) =>
        week.map((day, dayIndex) => (
          <rect
            className={LEVEL_CLASSES[day.level]}
            data-activity-date={day.date}
            data-level={day.level}
            height={cellSize}
            key={day.date}
            rx="2"
            width={cellSize}
            x={gridLeft + weekIndex * pitch}
            y={MONTH_ROW + dayIndex * pitch}
          >
            <title>{formatActivityTitle(day, locale, t)}</title>
          </rect>
        )),
      )}
    </svg>
  );
}

export function ActivityLegend({ className }: { className?: string }) {
  const { t } = useI18n();

  return (
    <span className={cn('flex items-center gap-1', className)}>
      <span>{t('activity.less')}</span>
      {HEATMAP_LEVELS.map((level) => (
        <svg
          aria-hidden="true"
          className="block"
          height="9"
          key={level}
          role="presentation"
          viewBox="0 0 9 9"
          width="9"
        >
          <rect className={LEVEL_CLASSES[level]} height="9" rx="2" width="9" />
        </svg>
      ))}
      <span>{t('activity.more')}</span>
    </span>
  );
}

/**
 * One label per month change, placed on the week where the month starts. A month
 * whose first week lands too close to the previous label is skipped rather than
 * overlapped — a collided pair is less readable than a missing one.
 */
function monthLabels(
  weeks: ActivityDay[][],
  locale: Locale,
): Array<{ label: string; weekIndex: number }> {
  const labels: Array<{ label: string; weekIndex: number }> = [];
  let previousMonth: number | null = null;

  weeks.forEach((week, weekIndex) => {
    const first = week[0];
    if (!first) return;
    const date = new Date(`${first.date}T00:00:00.000Z`);
    const month = date.getUTCMonth();
    if (month === previousMonth) return;
    previousMonth = month;

    const last = labels.at(-1);
    if (last && weekIndex - last.weekIndex < MIN_MONTH_GAP) return;

    labels.push({
      // en-US, not en-GB: en-GB renders September as "Sept", the only
      // four-character short month, which is both wider than every other axis
      // label and the most likely to collide at this font size.
      label: new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale, {
        month: 'short',
        timeZone: 'UTC',
      }).format(date),
      weekIndex,
    });
  });

  return labels;
}

function formatActivityTitle(
  day: ActivityDay,
  locale: Locale,
  t: Translate,
): string {
  const date = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${day.date}T00:00:00.000Z`));
  const drafted = t(
    day.drafted === 1 ? 'activity.draftedOne' : 'activity.draftedMany',
    { count: day.drafted },
  );
  return t('activity.dayTitle', {
    date,
    drafted,
    sent: t('activity.sent', { count: day.sent }),
  });
}
