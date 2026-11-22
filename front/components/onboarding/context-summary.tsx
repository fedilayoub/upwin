import Link from 'next/link';
import { ContextStatusBadge } from '@/components/onboarding/context-status-badge';
import { Button } from '@/components/ui/button';
import { Hardware } from '@/components/ui/hardware/hardware';
import { Meter } from '@/components/ui/hardware/meter';
import { StarBorder } from '@/components/ui/star-border';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { FreelancerContext } from '@/lib/api';
import {
  freelancerContextCompleteness,
  type ContextSlot,
} from '@/lib/context-completeness';

/**
 * The at-a-glance panel both the overview and the review page open with:
 * status, how much is filled in, the four figures worth counting, and what is
 * still empty. `showActions` is off on the review page, where the same links
 * already sit in the header.
 */
export function ContextSummary({
  context,
  copy,
  locale,
  showActions = true,
}: {
  context: FreelancerContext;
  copy: Dictionary['onboarding'];
  locale: Locale;
  showActions?: boolean;
}) {
  const completeness = freelancerContextCompleteness(context);
  const trusted = context.confirmedAt !== null;
  const figures = [
    {
      key: 'years',
      label: copy.summary.years,
      value:
        context.experience.years === undefined
          ? '—'
          : `${context.experience.years} ${copy.summary.yearsUnit}`,
    },
    {
      key: 'roles',
      label: copy.summary.roles,
      value: context.experience.roles.length,
    },
    { key: 'skills', label: copy.summary.skills, value: context.skills.length },
    {
      key: 'projects',
      label: copy.summary.projects,
      value: context.portfolio.length,
    },
  ];

  return (
    <StarBorder as="section" className="bg-card">
      <div className="flex flex-col gap-4 border-b border-dashed p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">
              {copy.summary.title}
            </h2>
            <ContextStatusBadge copy={copy} trusted={trusted} />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {trusted ? copy.review.trustedDescription : copy.review.untrustedDescription}
          </p>
        </div>
        {showActions ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild size="sm" variant={trusted ? 'outline' : 'default'}>
              <Link href={`/${locale}/context/review`}>
                {copy.summary.openReview}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/${locale}/context/review?edit=1`}>
                {copy.summary.edit}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      <Hardware className="hardware-stats grid gap-5 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <p id="context-completeness" className="text-xs font-medium uppercase tracking-wide text-[var(--help)]">
                {copy.summary.completeness}
              </p>
              <p className="text-sm font-semibold tabular-nums">
                {completeness.percent}%
              </p>
            </div>
            <Meter
              aria-labelledby="context-completeness"
              aria-describedby="context-filled"
              value={completeness.percent}
            />
            <p id="context-filled" className="text-xs text-[var(--help)]">
              {copy.summary.filled
                .replace('{filled}', String(completeness.filled))
                .replace('{total}', String(completeness.total))}
            </p>
          </div>

          <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
            {figures.map((figure) => (
              <div className="flex items-baseline gap-2" key={figure.key}>
                <dd className="text-lg font-semibold tabular-nums">
                  {figure.value}
                </dd>
                <dt className="text-xs text-[var(--help)]">{figure.label}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-2 lg:border-l lg:border-[var(--groove)] lg:pl-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--help)]">
            {copy.summary.missingTitle}
          </p>
          {completeness.missing.length === 0 ? (
            <p className="text-sm text-[var(--help)]">
              {copy.summary.allFilled}
            </p>
          ) : (
            <>
              <ul className="flex flex-wrap gap-1.5">
                {completeness.missing.map((slot) => (
                  <li
                    className="rounded-full border border-dashed border-[var(--groove)] px-2.5 py-1 text-xs text-[var(--help)]"
                    key={slot}
                  >
                    {slotLabel(slot, copy.review)}
                  </li>
                ))}
              </ul>
              <p className="text-xs leading-5 text-[var(--help)]">
                {copy.summary.missingDescription}
              </p>
            </>
          )}
        </div>
      </Hardware>
    </StarBorder>
  );
}

function slotLabel(
  slot: ContextSlot,
  copy: Dictionary['onboarding']['review'],
): string {
  switch (slot) {
    case 'experienceYears':
      return copy.yearsExperience;
    case 'roles':
      return copy.roles;
    case 'skills':
      return copy.skills;
    case 'portfolio':
      return copy.portfolioSection;
    case 'targetRole':
      return copy.targetRole;
    case 'targetClients':
      return copy.targetClients;
    case 'targetIndustries':
      return copy.targetIndustries;
    case 'targetRate':
      return copy.targetRate;
    case 'tone':
      return copy.tone;
    case 'services':
      return copy.services;
  }
}
