import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useI18n } from '@/features/i18n/i18n-context';
import type {
  PriorityOutcomeStatus,
  ProfileAnalysis,
  ProfileRecommendation,
} from '@/types/profile';
import { EvidenceList } from './evidence-list';
import {
  profileImpactLabel,
  profileSectionLabels,
} from './profile-i18n';

const TOP_PRIORITY_COUNT = 3;

export function PriorityList({
  analysis,
  onViewRecommendation,
}: {
  analysis: ProfileAnalysis;
  onViewRecommendation: (recommendation: ProfileRecommendation) => void;
}) {
  const { t } = useI18n();
  const priorities = analysis.priorities.slice(0, TOP_PRIORITY_COUNT);
  if (priorities.length === 0) return null;

  return (
    <Card
      className="overflow-hidden rounded-2xl border-border/70 shadow-[0_18px_40px_-34px_var(--profile-shadow)]"
      data-priority-list
    >
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{t('profile.fixFirst')}</CardTitle>
        <span className="text-xs font-medium text-muted-foreground">
          {t('profile.topCount', { count: priorities.length })}
        </span>
      </CardHeader>
      <CardContent className="p-0 pt-1">
        {priorities.map((recommendation) => (
          <PriorityCard
            key={recommendation.id}
            onView={() => onViewRecommendation(recommendation)}
            recommendation={recommendation}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function PriorityCard({
  onView,
  recommendation,
}: {
  onView: () => void;
  recommendation: ProfileRecommendation;
}) {
  const { t } = useI18n();
  const sectionLabels = profileSectionLabels(t);

  return (
    <article
      className="border-t border-border/70 px-4 py-4 first:border-t-0"
      data-priority-item={recommendation.rank}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary-strong">
          #{recommendation.rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">
            {sectionLabels[recommendation.section]}
          </p>
          {/* The recommendation is the actionable sentence — it leads the card. */}
          <p className="mt-0.5 text-sm font-semibold leading-snug">
            {recommendation.recommendation}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge
              variant={recommendation.impact === 'high' ? 'warning' : 'outline'}
            >
              {profileImpactLabel(recommendation.impact, t)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t('profile.minutes', {
                count: recommendation.estimatedMinutes,
              })}
            </span>
            <PreviousOutcomeBadge outcome={recommendation.previousOutcome} />
          </div>
        </div>
      </div>

      {recommendation.previousOutcome ? (
        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
          {recommendation.previousOutcome.note}
        </p>
      ) : null}

      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
        {recommendation.reason}
      </p>

      {recommendation.evidence.length > 0 ? (
        <details className="group mt-2">
          <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90" />
            {t('profile.evidence')} ({recommendation.evidence.length})
          </summary>
          <EvidenceList
            evidence={recommendation.evidence}
            showLabel={false}
          />
        </details>
      ) : null}

      <Button
        className="mt-2 h-8 px-0 text-primary-strong hover:bg-transparent hover:text-primary-strong active:translate-y-px"
        onClick={onView}
        size="sm"
        variant="ghost"
      >
        {recommendation.kind === 'fill'
          ? t('profile.viewRecommendations')
          : t('profile.viewSuggestion')}{' '}
        <ArrowUpRight />
      </Button>
    </article>
  );
}

const OUTCOME_LABEL_KEYS = {
  implemented: 'profile.outcome.implemented',
  partial: 'profile.outcome.partial',
  'not-implemented': 'profile.outcome.notImplemented',
} as const satisfies Record<PriorityOutcomeStatus, string>;

/**
 * Says what became of this advice since the last analysis. Renders nothing when
 * the priority is new — an absent verdict must never read as "you did nothing".
 */
function PreviousOutcomeBadge({
  outcome,
}: {
  outcome: ProfileRecommendation['previousOutcome'];
}) {
  const { t } = useI18n();
  if (!outcome) return null;

  return (
    <Badge
      data-priority-outcome={outcome.status}
      variant={outcome.status === 'implemented' ? 'success' : 'outline'}
    >
      {t(OUTCOME_LABEL_KEYS[outcome.status])}
    </Badge>
  );
}
