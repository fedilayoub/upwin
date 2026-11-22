import { useMemo, type ReactNode } from 'react';
import { ChevronRight, Target } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/features/i18n/i18n-context';
import { cn } from '@/lib/utils';
import {
  PROFILE_SECTION_IDS,
  type ProfileAnalysis,
} from '@/types/profile';
import { EvidenceList } from './evidence-list';
import { scoreTone } from './score-tone';
import { profileSectionLabels } from './profile-i18n';

export function ProfileBreakdown({ analysis }: { analysis: ProfileAnalysis }) {
  const { t } = useI18n();

  return (
    <ScoreBreakdown
      labels={profileSectionLabels(t)}
      orderedIds={PROFILE_SECTION_IDS}
      promotedDescription={t('profile.goalAlignmentHelp')}
      promotedId="goalAlignment"
      sections={analysis.sectionScores}
      title={t('profile.breakdown')}
    />
  );
}

export interface ScoreBreakdownSection {
  id: string;
  score: number;
  criteria: Array<{
    id: string;
    label: string;
    evidence: string[];
  }>;
}

export function ScoreBreakdown({
  labels,
  orderedIds,
  promotedDescription,
  promotedId,
  sections,
  title,
}: {
  labels: Readonly<Record<string, string>>;
  orderedIds: readonly string[];
  promotedDescription?: string;
  promotedId?: string;
  sections: ScoreBreakdownSection[];
  title: string;
}) {
  const sectionById = useMemo(
    () => new Map(sections.map((section) => [section.id, section])),
    [sections],
  );

  return (
    <Card
      className="overflow-hidden rounded-2xl border-border/70 shadow-[0_18px_40px_-34px_var(--profile-shadow)]"
      data-score-breakdown
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col p-2 pt-1">
        {orderedIds.map((sectionId) => {
          const section = sectionById.get(sectionId);
          if (section === undefined) return null;

          return (
            <SectionRow
              isPromoted={sectionId === promotedId}
              key={sectionId}
              label={labels[sectionId] ?? sectionId}
              promotedDescription={promotedDescription}
              section={section}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

function SectionRow({
  isPromoted,
  label,
  promotedDescription,
  section,
}: {
  isPromoted: boolean;
  label: string;
  promotedDescription?: string;
  section: ScoreBreakdownSection;
}) {
  const { t } = useI18n();
  const evidenced = section.criteria.filter(
    ({ evidence }) => evidence.length > 0,
  );
  // The rubric version decides how many criteria a section carries, so the row
  // asks whether there is anything to reveal rather than assuming a count.
  const isExpandable = evidenced.length > 0;

  const summary = (
    <>
      <div className="flex items-center gap-2">
        {isExpandable ? (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90" />
        ) : (
          <span aria-hidden="true" className="size-3.5 shrink-0" />
        )}
        {isPromoted ? (
          <Target className="size-3.5 shrink-0 text-warning-foreground" />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {label}
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {section.score}
        </span>
      </div>
      <Progress
        className="mt-1.5"
        label={t('profile.sectionScore', { label })}
        tone={scoreTone(section.score)}
        value={section.score}
      />
      {isPromoted && promotedDescription ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {promotedDescription}
        </p>
      ) : null}
    </>
  );

  return (
    <SectionRowShell
      isExpandable={isExpandable}
      isPromoted={isPromoted}
      sectionId={section.id}
      summary={summary}
    >
      <div className="mt-3 ml-0 space-y-2.5 border-t border-border/60 pt-3 min-[320px]:ml-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {t('profile.evidence')}
        </p>
        {evidenced.map((criterion) => (
          <div key={criterion.id}>
            <p className="text-xs font-semibold text-foreground">
              {criterion.label}
            </p>
            <EvidenceList evidence={criterion.evidence} showLabel={false} />
          </div>
        ))}
      </div>
    </SectionRowShell>
  );
}

/**
 * `<details>` rather than a `useState` toggle: it is keyboard and screen-reader
 * accessible without a dependency, browser find-in-page still reaches collapsed
 * evidence, and both states exist in the server-rendered markup the test suite
 * asserts against (vitest runs in `node`, with no click simulation available).
 */
function SectionRowShell({
  children,
  isExpandable,
  isPromoted,
  sectionId,
  summary,
}: {
  children: ReactNode;
  isExpandable: boolean;
  isPromoted: boolean;
  sectionId: string;
  summary: ReactNode;
}) {
  const shell = cn(
    'px-3 py-3',
    isPromoted
      ? 'order-first mb-1 rounded-xl border border-warning/20 bg-warning/8'
      : 'border-b border-border/60 last:border-b-0',
  );

  if (!isExpandable) {
    return (
      <div
        className={shell}
        data-promoted={isPromoted ? 'true' : undefined}
        data-section-id={sectionId}
      >
        {summary}
      </div>
    );
  }

  return (
    <details
      className={cn('group', shell)}
      data-promoted={isPromoted ? 'true' : undefined}
      data-section-id={sectionId}
    >
      <summary className="cursor-pointer list-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      <div data-section-evidence>{children}</div>
    </details>
  );
}
