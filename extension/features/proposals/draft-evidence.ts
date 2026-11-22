import { DIMENSION_LABELS } from '@/features/jobs/dimension-labels';
import type { JobAnalysis, JobCaptureResult } from '@/types/job';

const TITLE_LIMIT = 40;

export function jobCaptureChips(capture: JobCaptureResult): string[] {
  const { job } = capture.snapshot;
  const chips = [truncateTitle(job.title)];
  const budget = budgetChip(job.engagement);

  if (budget) chips.push(budget);
  pushCount(chips, job.skills.length, 'skill');
  chips.push(
    job.questions.length === 0
      ? 'No screening questions'
      : countLabel(job.questions.length, 'screening question'),
  );
  if (job.client.country) chips.push(job.client.country);
  if (job.client.paymentVerified === true) chips.push('Payment verified');
  pushCount(
    chips,
    capture.truncatedFields.length,
    'field truncated',
    'fields truncated',
  );

  return chips;
}

export function matchChips(analysis: JobAnalysis): string[] {
  const dimensions = [...analysis.dimensions]
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map(
      (dimension) =>
        `${DIMENSION_LABELS[dimension.id]} ${dimension.score}/100`,
    );

  return [`Match ${analysis.matchScore}/100`, ...dimensions];
}

function budgetChip(
  engagement: JobCaptureResult['snapshot']['job']['engagement'],
): string | null {
  if (engagement.budgetType === 'unknown') return null;

  if (engagement.budgetType === 'fixed') {
    if (!engagement.fixedBudget) return 'Fixed price';
    const { amount, currency } = engagement.fixedBudget;
    return `${formatMoney(amount, currency)} fixed`;
  }

  if (!engagement.hourlyBudget) return 'Hourly';
  const { currency, max, min } = engagement.hourlyBudget;
  if (min !== undefined && max !== undefined) {
    return `${formatMoney(min, currency)}–${formatMoney(max, currency)}/hr`;
  }
  if (min !== undefined) return `${formatMoney(min, currency)}+/hr`;
  if (max !== undefined) return `Up to ${formatMoney(max, currency)}/hr`;
  return 'Hourly';
}

function formatMoney(amount: number, currency: string): string {
  const prefix = currency === 'USD' ? '$' : `${currency} `;
  return `${prefix}${amount.toLocaleString('en-US')}`;
}

function truncateTitle(title: string): string {
  if (title.length <= TITLE_LIMIT) return title;
  return `${title.slice(0, TITLE_LIMIT - 1).trimEnd()}…`;
}

function countLabel(
  count: number,
  singularLabel: string,
  pluralLabel = `${singularLabel}s`,
): string {
  return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
}

function pushCount(
  chips: string[],
  count: number,
  singularLabel: string,
  pluralLabel?: string,
): void {
  if (count === 0) return;
  chips.push(countLabel(count, singularLabel, pluralLabel));
}
