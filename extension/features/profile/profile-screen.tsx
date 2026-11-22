import { ErrorReference } from '@/components/shared/error-notice';
import type { ErrorRecord } from '@/features/diagnostics/errors';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Clock3,
  Copy,
  GitCompare,
  Images,
  ListChecks,
  LoaderCircle,
  RotateCw,
  ScanSearch,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from '@/components/ai/chain-of-thought';
import { ScoreTrendChart } from '@/components/charts/score-trend-chart';
import { PageHeading } from '@/components/shared/page-heading';
import { BrandThinkingOrb } from '@/components/shared/brand-thinking-orb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppUrl, useConnection } from '@/features/connection/connection-context';
import type { TranslationKey } from '@/features/i18n/dictionaries/en';
import { useI18n, type Translate } from '@/features/i18n/i18n-context';
import {
  buildPlatformDeepLink,
  PlatformLink,
} from '@/features/platform/platform-link';
import { useAsyncAction } from '@/hooks/use-async-action';
import { cn } from '@/lib/utils';
import { profileService } from '@/services/profile';
import type { ProfileSnapshot } from '@/features/upwork/profile/schema';
import type { OrbState } from 'thinking-orbs/engine';
import {
  copyProfileSuggestion,
  requestSuggestionKeepingCurrent,
} from './suggestion-actions';
import {
  profileCaptureChips,
  profileCompletenessChips,
} from './capture-evidence';
import { EvidenceList } from './evidence-list';
import { ProfileBreakdown } from './profile-breakdown';
import { ScoreSummaryCard } from './score-summary-card';
import {
  type ProfilePageState,
  useProfilePageStatus,
} from './use-profile-page-status';
import { PriorityList } from './priority-list';
import {
  profileGoalLabel,
  profileImpactLabel,
  profileSectionLabels,
} from './profile-i18n';
import {
  SECTION_LABELS,
  SUGGESTION_FIELD_LABELS,
} from './section-labels';
import {
  type ProfileAnalysis,
  type ProfileAnalysisProgress,
  type ProfileAnalyzerSetup,
  type ProfileCompletenessRecommendation,
  type ProfileRecommendation,
  type ProfileSnapshotDiff,
  type ProfileSuggestion,
} from '@/types/profile';

// Re-exported so the feature keeps one public entry point after the split.
export { EvidenceList, ProfileBreakdown, PriorityList };

const GOALS_PATH = '/goals';
const CONTEXT_CONFIRMATION_PATH = '/context/review';

const ANALYSIS_STAGE_KEYS = [
  'profile.stage.captured',
  'profile.stage.completeness',
  'profile.stage.positioning',
  'profile.stage.target',
  'profile.stage.portfolio',
  'profile.stage.recommendations',
] as const satisfies ReadonlyArray<TranslationKey>;

const ANALYSIS_ORB_STATES = [
  'searching',
  'solving',
  'shaping',
  'searching',
  'connecting',
  'weaving',
] as const satisfies ReadonlyArray<OrbState>;

const ANALYSIS_STAGE_ICONS = [
  ScanSearch,
  ListChecks,
  Target,
  GitCompare,
  Images,
  Sparkles,
] as const satisfies ReadonlyArray<LucideIcon>;

interface RunCapturedAnalysisDependencies {
  analyze: (
    snapshot: ProfileSnapshot,
    goalId?: string,
  ) => Promise<ProfileAnalysis>;
  capture: () => Promise<{ snapshot: ProfileSnapshot }>;
  onCaptured?: (snapshot: ProfileSnapshot) => void;
}

export async function runCapturedAnalysis(
  dependencies: RunCapturedAnalysisDependencies,
  goalId?: string,
): Promise<ProfileAnalysis> {
  const capture = await dependencies.capture();
  dependencies.onCaptured?.(capture.snapshot);
  return dependencies.analyze(capture.snapshot, goalId);
}

/** Capture failures caused by the tab rather than by the analysis itself. */
const PAGE_CAPTURE_ERROR_CODES: ReadonlySet<string> = new Set([
  'OWN_PROFILE_NOT_DETECTED',
  'PROFILE_CAPTURE_FAILED',
  'UNSUPPORTED_PAGE',
]);

export function ProfileScreen({
  autoAnalyzeRequestedAt = null,
  onAutoAnalyzeHandled,
}: {
  /**
   * Timestamp of an on-page Analyze click the panel has already consumed. A
   * timestamp rather than a boolean so a second click starts a second analysis
   * while the same screen stays mounted.
   */
  autoAnalyzeRequestedAt?: number | null;
  /**
   * Called once the request is acted on. The owner clears it so a remount
   * (leaving the section and coming back) cannot replay the capture.
   */
  onAutoAnalyzeHandled?: () => void;
} = {}) {
  const { getToken } = useConnection();
  const { t } = useI18n();
  const setup = useAsyncAction(profileService.getSetup);
  const pageStatus = useProfilePageStatus();
  // Survives a failed re-analysis, which clears the action's own data.
  const [freshResult, setFreshResult] = useState<ProfileAnalysis | null>(
    null,
  );
  const [progressIndex, setProgressIndex] = useState(0);
  const [capturedSnapshot, setCapturedSnapshot] =
    useState<ProfileSnapshot | null>(null);
  const [historyOverride, setHistoryOverride] = useState<{
    progress: ProfileAnalysisProgress;
    snapshotDiff: ProfileSnapshotDiff | null;
  } | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<ProfileRecommendation | null>(null);

  const runAnalysis = useCallback(
    async (goalId?: string): Promise<ProfileAnalysis> => {
      setSelectedRecommendation(null);
      setProgressIndex(0);
      setCapturedSnapshot(null);
      let timer: ReturnType<typeof globalThis.setInterval> | undefined;

      try {
        const result = await runCapturedAnalysis(
          {
            analyze: (snapshot, selectedGoalId) =>
              profileService.analyze(snapshot, getToken, selectedGoalId),
            capture: profileService.capture,
            onCaptured: (snapshot) => {
              setCapturedSnapshot(snapshot);
              // Capture validation also completes the local completeness check
              // before any profile text crosses the API boundary.
              setProgressIndex(2);
              timer = globalThis.setInterval(() => {
                setProgressIndex((current) => Math.min(current + 1, 5));
              }, 900);
            },
          },
          goalId,
        );

        // Checks appear only after the backend has actually returned success.
        setProgressIndex(ANALYSIS_STAGE_KEYS.length);
        await new Promise<void>((resolve) => {
          globalThis.setTimeout(resolve, 300);
        });

        try {
          const [progress, snapshotDiff] = await Promise.all([
            profileService.getProgress(getToken),
            profileService.getSnapshotDiff(getToken),
          ]);
          setHistoryOverride({ progress, snapshotDiff });
        } catch {
          // The analysis itself succeeded. Keep showing the previously loaded
          // history if an ancillary refresh is temporarily unavailable.
        }
        setFreshResult(result);
        return result;
      } finally {
        if (timer !== undefined) globalThis.clearInterval(timer);
      }
    },
    [getToken],
  );
  const analysis = useAsyncAction(runAnalysis);

  useEffect(() => {
    if (setup.status === 'idle') void setup.execute(getToken);
  }, [getToken, setup.execute, setup.status]);

  const activeResult = freshResult ?? setup.data?.latestAnalysis ?? null;
  const captureError =
    analysis.error !== null &&
    analysis.errorCode !== null &&
    PAGE_CAPTURE_ERROR_CODES.has(analysis.errorCode)
      ? analysis.error
      : null;

  const startAnalysis = useCallback(() => {
    void analysis.execute(setup.data?.activeGoal?.id);
  }, [analysis.execute, setup.data?.activeGoal?.id]);

  // A failed capture may mean the tab moved since the last look. Refresh so
  // the analyzer can say which page to open rather than repeat the failure.
  const refreshPage = pageStatus.refresh;
  useEffect(() => {
    if (captureError !== null) void refreshPage();
  }, [captureError, refreshPage]);

  // Once the tab lands on another kind of page, an earlier capture failure no
  // longer describes it. Checking is a transition, not a settled answer.
  const settledPageState =
    pageStatus.status === 'checking' ? null : pageStatus.status;
  const previousPageStateRef = useRef<ProfilePageState | null>(null);
  const resetAnalysis = analysis.reset;
  useEffect(() => {
    if (settledPageState === null) return;
    const previous = previousPageStateRef.current;
    previousPageStateRef.current = settledPageState;
    if (previous !== null && previous !== settledPageState && captureError) {
      resetAnalysis();
    }
  }, [captureError, resetAnalysis, settledPageState]);

  // Waits for setup so the analysis carries the active goal, exactly as the
  // button does, and for the page check so a stale on-page click cannot run a
  // capture that is bound to fail. The ref makes each click run once: the
  // effect re-runs whenever its inputs change, and capture must not repeat.
  const handledAnalyzeRequestRef = useRef<number | null>(null);
  useEffect(() => {
    if (autoAnalyzeRequestedAt === null) return;
    if (handledAnalyzeRequestRef.current === autoAnalyzeRequestedAt) return;
    if (setup.status !== 'success') return;
    if (analysis.status === 'loading') return;
    if (pageStatus.status === 'checking') return;

    handledAnalyzeRequestRef.current = autoAnalyzeRequestedAt;
    onAutoAnalyzeHandled?.();
    if (pageStatus.status === 'ready') startAnalysis();
  }, [
    analysis.status,
    autoAnalyzeRequestedAt,
    onAutoAnalyzeHandled,
    pageStatus.status,
    setup.status,
    startAnalysis,
  ]);

  if (setup.status === 'idle' || setup.status === 'loading') {
    return <ProfileSkeleton />;
  }

  if (setup.error || !setup.data) {
    return (
      <ProfileLoadError
        failure={setup.failure}
        message={setup.error ?? t('profile.loadError')}
        onRetry={() => void setup.execute(getToken)}
      />
    );
  }

  if (analysis.status === 'loading') {
    return (
      <AnalysisProgress
        goalLabel={setup.data.activeGoal?.targetRole}
        progressIndex={progressIndex}
        snapshot={capturedSnapshot ?? undefined}
      />
    );
  }

  // With results on screen, a wrong-page failure is explained beside the
  // re-analyze button instead of replacing the results with a dead end.
  if (analysis.error && !(captureError && activeResult)) {
    return (
      <ProfileAnalysisError
        code={analysis.errorCode}
        failure={analysis.failure}
        message={analysis.error}
        onBack={() => analysis.reset()}
        onRetry={startAnalysis}
      />
    );
  }

  if (activeResult) {
    if (selectedRecommendation) {
      return (
        <RecommendationDetail
          analysisId={activeResult.id}
          onBack={() => setSelectedRecommendation(null)}
          recommendation={selectedRecommendation}
        />
      );
    }

    return (
      <ProfileResults
        analysis={activeResult}
        captureError={captureError}
        onAnalyzeUpdatedProfile={startAnalysis}
        onRecheckPage={pageStatus.recheck}
        onViewRecommendation={setSelectedRecommendation}
        pageState={pageStatus.status}
        progress={historyOverride?.progress ?? setup.data.progress}
        snapshotDiff={
          historyOverride
            ? historyOverride.snapshotDiff
            : setup.data.snapshotDiff
        }
      />
    );
  }

  return (
    <ProfileEntry
      hasPreviousAnalysis={setup.data.latestAnalysis !== null}
      onAnalyze={startAnalysis}
      onRecheckPage={pageStatus.recheck}
      pageError={pageStatus.error}
      pageState={pageStatus.status}
      setup={setup.data}
    />
  );
}

interface ProfileEntryProps {
  hasPreviousAnalysis: boolean;
  onAnalyze: () => void;
  /** Re-reads the current tab after the user opens their profile there. */
  onRecheckPage?: () => void;
  pageError: string | null;
  pageState: ProfilePageState;
  platformUrl?: string;
  setup: ProfileAnalyzerSetup;
}

export function ProfileEntry({
  hasPreviousAnalysis,
  onAnalyze,
  onRecheckPage,
  pageError,
  pageState,
  platformUrl: platformUrlProp,
  setup,
}: ProfileEntryProps) {
  const { t } = useI18n();
  const appUrl = useAppUrl();
  const platformUrl = platformUrlProp ?? appUrl;
  const summaryId = useId();
  const { activeGoal, contextConfirmed } = setup;
  const requirements: SetupRequirement[] = [
    {
      action: onRecheckPage ? (
        <RecheckPageButton onClick={onRecheckPage} />
      ) : null,
      help: pageError ?? t('profile.setup.profileMissingHelp'),
      id: 'profile',
      label:
        pageState === 'checking'
          ? t('profile.setup.profileChecking')
          : pageState === 'ready'
            ? t('profile.setup.profileReady')
            : t('profile.setup.profileMissing'),
      state: pageState,
    },
    {
      action: (
        <PlatformLink
          label={t('profile.setup.goalAction')}
          path={GOALS_PATH}
          platformUrl={platformUrl}
        />
      ),
      help: t('profile.setup.goalMissingHelp'),
      id: 'goal',
      label: activeGoal
        ? t('profile.setup.goalReady')
        : t('profile.setup.goalMissing'),
      state: activeGoal ? 'ready' : 'missing',
    },
    {
      action: (
        <PlatformLink
          label={t('profile.confirmContext')}
          path={CONTEXT_CONFIRMATION_PATH}
          platformUrl={platformUrl}
        />
      ),
      help: t('profile.setup.contextMissingHelp'),
      id: 'context',
      label: contextConfirmed
        ? t('profile.setup.contextReady')
        : t('profile.setup.contextMissing'),
      state: contextConfirmed ? 'ready' : 'missing',
    },
  ];
  const missingCount = requirements.filter(
    (requirement) => requirement.state === 'missing',
  ).length;
  const checking = pageState === 'checking';
  const canAnalyze = missingCount === 0 && !checking;
  const targetTags = activeGoal
    ? activeGoal.preferredSkills.length > 0
      ? activeGoal.preferredSkills
      : activeGoal.targetProjectTypes
    : [];

  return (
    <div className="space-y-4" data-profile-screen="entry">
      <PageHeading
        description={t('profile.description')}
        icon={UserRound}
        title={t('profile.title')}
      />

      <Card
        className="overflow-hidden rounded-2xl border-primary/15 shadow-[0_20px_46px_-34px_var(--profile-shadow)]"
        data-profile-entry
      >
        <CardContent className="grid p-0 min-[760px]:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <section className="bg-primary/6 px-4 pt-4 pb-5">
            <div className="flex items-start gap-3">
              <EntryIcon>
                <Target className="size-4" />
              </EntryIcon>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-primary-strong">
                  {t('profile.activeTarget')}
                </p>
                <h2 className="mt-1 text-base font-semibold leading-tight tracking-[-0.02em] text-balance">
                  {activeGoal?.targetRole ?? t('profile.configureTarget')}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {activeGoal
                    ? profileGoalLabel(activeGoal.objective, t)
                    : t('profile.noActiveGoal')}
                </p>
                {targetTags.length > 0 ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {targetTags.slice(0, 4).join(', ')}
                    {targetTags.length > 4
                      ? t('profile.moreCount', {
                          count: targetTags.length - 4,
                        })
                      : ''}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="border-t border-border/70 px-4 pt-4 pb-5 min-[760px]:border-t-0 min-[760px]:border-l">
            <p
              className={cn(
                'flex items-center gap-2 text-sm font-semibold leading-snug',
                missingCount > 0
                  ? 'text-warning-foreground'
                  : checking
                    ? 'text-muted-foreground'
                    : 'text-success',
              )}
              data-setup-summary={
                missingCount > 0 ? 'missing' : checking ? 'checking' : 'ready'
              }
              id={summaryId}
              role="status"
            >
              {missingCount > 0 ? (
                <CircleAlert aria-hidden className="size-4 shrink-0" />
              ) : checking ? (
                <LoaderCircle
                  aria-hidden
                  className="size-4 shrink-0 animate-spin"
                />
              ) : (
                <CircleCheck aria-hidden className="size-4 shrink-0" />
              )}
              {missingCount > 1
                ? t('profile.setup.missingMany', { count: missingCount })
                : missingCount === 1
                  ? t('profile.setup.missingOne')
                  : checking
                    ? t('profile.setup.checking')
                    : t('profile.setup.ready')}
            </p>

            <ul className="mt-3 space-y-2">
              {requirements.map((requirement) => (
                <SetupRequirementRow
                  key={requirement.id}
                  requirement={requirement}
                />
              ))}
            </ul>

            <Button
              aria-describedby={canAnalyze ? undefined : summaryId}
              className="mt-4 h-10 w-full active:translate-y-px"
              disabled={!canAnalyze}
              onClick={onAnalyze}
            >
              <ScanSearch /> {t('profile.analyze')}
            </Button>

            {activeGoal ? (
              <div className="mt-4 text-xs">
                <PlatformLink
                  label={t('profile.changeGoal')}
                  path={GOALS_PATH}
                  platformUrl={platformUrl}
                />
              </div>
            ) : null}
          </section>
        </CardContent>
      </Card>

      {!hasPreviousAnalysis ? (
        <div className="flex gap-3 rounded-xl border border-dashed border-border/80 px-3 py-3.5">
          <Trophy className="mt-0.5 size-4 shrink-0 text-primary-strong" />
          <div>
            <p className="text-sm font-medium">{t('profile.noAnalysis')}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {t('profile.noAnalysisHelp')}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AnalysisProgress({
  goalLabel,
  progressIndex,
  snapshot,
}: {
  goalLabel?: string;
  progressIndex: number;
  snapshot?: ProfileSnapshot;
}) {
  const { t } = useI18n();
  const analysisStages = ANALYSIS_STAGE_KEYS.map((key) => t(key));
  const activeStageIndex = Math.min(progressIndex, analysisStages.length - 1);
  const activeStage = analysisStages[activeStageIndex];
  const activeOrbState = ANALYSIS_ORB_STATES[activeStageIndex];
  const captureChips = snapshot ? profileCaptureChips(snapshot) : [];
  const completenessChips = snapshot
    ? profileCompletenessChips(snapshot.completeness)
    : [];

  return (
    <div className="space-y-4" aria-live="polite" data-profile-screen="progress">
      <PageHeading
        description={t('profile.progressDescription')}
        icon={UserRound}
        title={t('profile.progressTitle')}
      />
      <Card className="overflow-hidden rounded-2xl border-primary/15 shadow-[0_20px_46px_-34px_var(--profile-shadow)]" data-analysis-progress>
        <CardContent className="grid gap-4 p-3 min-[320px]:p-4 min-[760px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <div className="flex items-center gap-3 rounded-xl bg-primary/7 p-3">
              <BrandThinkingOrb
                aria-label={`${activeStage}…`}
                className="shrink-0"
                size={64}
                state={activeOrbState}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-primary-strong">
                  {t('profile.progressActive')}
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug">
                  {activeStage}
                </p>
              </div>
            </div>
            <Progress
              className="mt-4"
              label={t('profile.progressLabel')}
              value={(Math.min(progressIndex, analysisStages.length) / analysisStages.length) * 100}
            />
          </div>
          <ChainOfThought defaultOpen>
            <ChainOfThoughtHeader>{activeStage}…</ChainOfThoughtHeader>
            <ChainOfThoughtContent>
              {analysisStages.map((stage, index) => {
                const isComplete = progressIndex >= analysisStages.length;
                const isVerifiedComplete =
                  isComplete || index < Math.min(progressIndex, 2);
                const isCurrent =
                  !isComplete && Math.min(progressIndex, 5) === index;
                const wasVisited = index < progressIndex;
                const status = isVerifiedComplete || wasVisited
                  ? 'complete'
                  : isCurrent
                    ? 'active'
                    : 'pending';
                const chips =
                  index === 0
                    ? captureChips
                    : index === 1
                      ? completenessChips
                      : index === 3 && goalLabel
                        ? [goalLabel]
                        : [];

                return (
                  <ChainOfThoughtStep
                    className={isVerifiedComplete ? 'text-success' : undefined}
                    icon={
                      isVerifiedComplete
                        ? CircleCheck
                        : wasVisited
                          ? CircleDot
                          : ANALYSIS_STAGE_ICONS[index]
                    }
                    indicator={
                      isCurrent ? (
                        <BrandThinkingOrb
                          aria-label={`${stage}…`}
                          className="shrink-0"
                          size={20}
                          state={ANALYSIS_ORB_STATES[index]}
                        />
                      ) : undefined
                    }
                    key={stage}
                    label={stage}
                    status={status}
                  >
                    {chips.length > 0 ? (
                      <ChainOfThoughtSearchResults>
                        {chips.map((chip) => (
                          <ChainOfThoughtSearchResult key={chip}>
                            {chip}
                          </ChainOfThoughtSearchResult>
                        ))}
                      </ChainOfThoughtSearchResults>
                    ) : null}
                  </ChainOfThoughtStep>
                );
              })}
            </ChainOfThoughtContent>
          </ChainOfThought>
        </CardContent>
      </Card>
    </div>
  );
}

interface ProfileResultsProps extends ReanalyzeState {
  analysis: ProfileAnalysis;
  onAnalyzeUpdatedProfile: () => void;
  onViewRecommendation: (recommendation: ProfileRecommendation) => void;
  progress: ProfileAnalysisProgress;
  snapshotDiff: ProfileSnapshotDiff | null;
}

export function ProfileResults({
  analysis,
  captureError,
  onAnalyzeUpdatedProfile,
  onRecheckPage,
  onViewRecommendation,
  pageState,
  progress,
  snapshotDiff,
}: ProfileResultsProps) {
  const { t } = useI18n();
  const sectionLabels = profileSectionLabels(t);
  const delta =
    analysis.previousWinningScore === null
      ? null
      : analysis.winningScore - analysis.previousWinningScore;

  return (
    <div
      className="@container/profile-results min-w-0 w-full max-w-full overflow-x-clip"
      data-profile-screen="results"
    >
      <div className="grid min-w-0 w-full max-w-full gap-4 @min-[760px]/profile-results:grid-cols-12">
        <div className="min-w-0 @min-[760px]/profile-results:col-span-12">
          <PageHeading
            description={t('profile.analyzedFor', {
              role: analysis.goal.targetRole,
            })}
            icon={UserRound}
            title={t('profile.results')}
          />
        </div>

        <div className="min-w-0 @min-[760px]/profile-results:col-span-6">
          <ScoreSummaryCard
            afterProgress={
              <div className="space-y-2.5">
                {delta !== null ? (
                  <Badge variant={delta >= 0 ? 'success' : 'warning'}>
                    {t('profile.fromPrevious', { delta: formatDelta(delta, t) })}
                  </Badge>
                ) : null}
                <CompletenessMeter analysis={analysis} />
              </div>
            }
            className="h-full"
            collapsibleSummary
            context={profileGoalLabel(analysis.goal.objective, t)}
            label={t('profile.winningScore')}
            score={analysis.winningScore}
            summary={analysis.summary}
            visual="gauge"
          >
            <div className="grid overflow-hidden rounded-xl border border-primary/12 bg-primary/12 @min-[320px]/score-summary:grid-cols-2">
              <ResultFact
                label={t('profile.strongest')}
                value={sectionLabels[analysis.strongestSection]}
              />
              <ResultFact
                label={t('profile.opportunity')}
                value={sectionLabels[analysis.biggestOpportunity]}
              />
            </div>
          </ScoreSummaryCard>
        </div>

        {/* High-impact fixes come before the full score breakdown. */}
        <div className="min-w-0 @min-[760px]/profile-results:col-span-6">
          <PriorityList
            analysis={analysis}
            onViewRecommendation={onViewRecommendation}
          />
        </div>

        <div className="min-w-0 @min-[760px]/profile-results:col-span-12">
          <ProfileBreakdown analysis={analysis} />
        </div>

        {/* History is secondary, so it sits below the breakdown rather than
         * between the score and the fixes. */}
        <div className="min-w-0 space-y-4 pt-1 @min-[760px]/profile-results:col-span-12">
          <header className="border-t border-border/70 pt-4">
            <h2 className="text-base font-semibold tracking-[-0.02em]">
              {t('profile.details')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t('profile.detailsHelp')}
            </p>
          </header>

          {progress.latest === null ? null : (
            <ProfileProgress progress={progress} />
          )}

          <SnapshotDiffPanel diff={snapshotDiff} />
        </div>
      </div>

      <ReanalyzeBar
        captureError={captureError}
        onAnalyze={onAnalyzeUpdatedProfile}
        onRecheckPage={onRecheckPage}
        pageState={pageState}
      />
    </div>
  );
}

/**
 * Completeness as a bar under the Winning Score, not a card of its own.
 *
 * It is a plain count of readable checks, so it shares the score's panel while
 * saying, in place, that it is NOT the goal-weighted score — the two numbers sit
 * inches apart and are easy to conflate. The fill recommendations it used to
 * list are the analysis's own `fill` priorities, which the priority list and the
 * recommendation flow already render; only their count is kept here.
 */
export function CompletenessMeter({ analysis }: { analysis: ProfileAnalysis }) {
  const { t } = useI18n();
  const fills = analysis.priorities.filter(isCompletenessRecommendation);

  // Null is "could not be read", which is not the same as zero. Say so rather
  // than drawing an empty bar that reads as a measured 0%.
  if (analysis.completenessScore === null) {
    return (
      <p
        className="flex gap-1.5 text-[11px] leading-tight text-muted-foreground"
        data-profile-completeness
      >
        <CircleAlert className="mt-px size-3.5 shrink-0" />
        <span>
          {t('profile.completenessUnknown')}
        </span>
      </p>
    );
  }

  return (
    <div data-profile-completeness>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium">
          {t('profile.completeness')}
        </p>
        <p className="text-xs font-semibold tabular-nums">
          {analysis.completenessScore}%
        </p>
      </div>
      <Progress
        className="mt-1.5"
        label={t('profile.completeness')}
        value={analysis.completenessScore}
      />
      <p className="mt-1.5 text-[10px] leading-tight text-muted-foreground">
        {t('profile.completenessSeparate')}
        {fills.length > 0
          ? t(
              fills.length === 1
                ? 'profile.fieldsToFillOne'
                : 'profile.fieldsToFillMany',
              { count: fills.length },
            )
          : ''}
        .
      </p>
    </div>
  );
}

export function ProfileProgress({
  progress,
}: {
  progress: ProfileAnalysisProgress;
}) {
  const { t } = useI18n();
  const sectionLabels = profileSectionLabels(t);
  const movedSections = progress.sectionDeltas.filter(
    ({ delta }) => delta !== null && delta !== 0,
  );

  return (
    <Card
      className="rounded-2xl border-border/70 shadow-[0_18px_40px_-34px_var(--profile-shadow)]"
      data-profile-progress
    >
      <CardHeader>
        <CardTitle>{t('profile.progressCard')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-2.5">
        {progress.latest === null ? (
          <p className="text-xs text-muted-foreground">
            {t('profile.progressEmpty')}
          </p>
        ) : (
          <>
            <div className="rounded-xl bg-muted/45 p-3" data-score-history>
              <div className="flex flex-col items-start gap-2 min-[320px]:flex-row min-[320px]:items-end min-[320px]:justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  {t('profile.latestAnalysis')}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {progress.latest.winningScore} / 100
                </p>
              </div>
              <Badge
                variant={
                  progress.deltaSinceFirst === null ||
                  progress.deltaSinceFirst >= 0
                    ? 'success'
                    : 'warning'
                }
              >
                {progress.deltaSinceFirst === null
                  ? t('profile.firstAnalysis')
                  : t('profile.sinceFirst', {
                      delta: formatDelta(progress.deltaSinceFirst, t),
                    })}
              </Badge>
              </div>
              <ScoreTrendChart
                label={t('profile.scoreHistory')}
                points={progress.trend.map(({ createdAt, id, winningScore }) => ({
                  createdAt,
                  id,
                  score: winningScore,
                }))}
              />
            </div>

            {movedSections.length > 0 ? (
              <div className="space-y-2" data-section-deltas>
                {movedSections.map((section) => (
                  <div
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-xs"
                    data-section-delta={section.id}
                    key={section.id}
                  >
                    <span className="font-medium">
                      {sectionLabels[section.id]}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {section.firstScore} → {section.latestScore}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * What the re-analyze action needs to know about the tab. Optional so a
 * results view rendered on its own (tests, history) reads as ready.
 */
interface ReanalyzeState {
  /** A wrong-page capture failure from the last attempt, if any. */
  captureError?: string | null;
  onRecheckPage?: () => void;
  pageState?: ProfilePageState;
}

/**
 * Re-analysis stays in reach from anywhere in the results: a slim bar that
 * floats just above the dock (`bottom-16` clears its 48px plus padding). A
 * hint is one short line inside the bar, never a panel over the results, and
 * the button stays visible, disabled, until the tab is the profile again.
 */
function ReanalyzeBar({
  captureError = null,
  onAnalyze,
  onRecheckPage,
  pageState = 'ready',
}: ReanalyzeState & { onAnalyze: () => void }) {
  const { t } = useI18n();
  const noticeId = useId();
  const notice =
    pageState === 'missing'
      ? t('profile.reanalyze.openProfile')
      : pageState === 'ready'
        ? captureError
        : null;

  return (
    <div
      className="sticky bottom-16 z-20 mt-4 rounded-[15px] border border-border/80 bg-background/88 p-1.5 shadow-[0_16px_40px_-22px_color-mix(in_oklab,var(--foreground)_36%,transparent),inset_0_1px_0_color-mix(in_oklab,var(--foreground)_8%,transparent)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/74"
      data-reanalyze={pageState}
    >
      <div aria-live="polite">
        {notice ? (
          <p
            className="flex items-center gap-2 px-1.5 pt-0.5 pb-1.5 text-xs leading-snug text-warning-foreground"
            id={noticeId}
          >
            <CircleAlert aria-hidden className="size-3.5 shrink-0" />
            <span className="line-clamp-2 min-w-0 flex-1 font-medium">
              {notice}
            </span>
            {pageState === 'missing' && onRecheckPage ? (
              <button
                aria-label={t('profile.setup.recheck')}
                className="grid size-6 shrink-0 place-items-center rounded-md text-foreground/80 outline-none hover:bg-warning/15 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/35"
                onClick={onRecheckPage}
                title={t('profile.setup.recheck')}
                type="button"
              >
                <RotateCw aria-hidden className="size-3.5" />
              </button>
            ) : null}
          </p>
        ) : null}
      </div>
      <Button
        aria-describedby={notice ? noticeId : undefined}
        className="h-9 w-full"
        disabled={pageState !== 'ready'}
        onClick={onAnalyze}
      >
        {pageState === 'checking' ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <ScanSearch />
        )}{' '}
        {t('profile.analyzeUpdated')}
      </Button>
    </div>
  );
}

/** Field-level changes since the last analysis. The action lives in the bar. */
export function SnapshotDiffPanel({
  diff,
}: {
  diff: ProfileSnapshotDiff | null;
}) {
  const { t } = useI18n();

  // With only one snapshot there is nothing to diff.
  if (diff === null) return null;

  return (
    <Card className="rounded-2xl border-border/70 shadow-[0_18px_40px_-34px_var(--profile-shadow)]" data-snapshot-diff-panel>
      <CardHeader>
        <CardTitle>{t('profile.sinceLast')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-2.5">
        <div className="space-y-2 text-xs" data-snapshot-diff>
          <SnapshotChange
            changed={diff.changes.title.status === 'changed'}
            label={
              diff.changes.title.status === 'changed'
                ? t('profile.titleChanged')
                : t('profile.titleUnchanged')
            }
          />
          <SnapshotChange
            changed={diff.changes.overview.status === 'updated'}
            label={
              diff.changes.overview.status === 'updated'
                ? t('profile.overviewUpdated')
                : t('profile.overviewUnchanged')
            }
          />
          <SnapshotChange
            changed={diff.changes.portfolio.status === 'changed'}
            label={portfolioChangeLabel(diff)}
          />
          <SnapshotChange
            changed={diff.changes.skills.status === 'changed'}
            label={skillsChangeLabel(diff)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SnapshotChange({
  changed,
  label,
}: {
  changed: boolean;
  label: string;
}) {
  return (
    <p className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={changed ? 'text-success' : 'text-muted-foreground'}
      >
        {changed ? '✓' : '—'}
      </span>
      <span>{label}</span>
    </p>
  );
}



function portfolioChangeLabel(diff: ProfileSnapshotDiff): string {
  const { added, removed, status } = diff.changes.portfolio;
  if (status === 'unchanged') return 'Portfolio unchanged';

  return [
    added > 0 ? `${added} portfolio ${pluralize('item', added)} added` : null,
    removed > 0
      ? `${removed} portfolio ${pluralize('item', removed)} removed`
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(', ');
}

function skillsChangeLabel(diff: ProfileSnapshotDiff): string {
  const { added, removed, status } = diff.changes.skills;
  if (status === 'unchanged') return 'Skills unchanged';

  return [
    added.length > 0
      ? `${added.length} ${pluralize('skill', added.length)} added`
      : null,
    removed.length > 0
      ? `${removed.length} ${pluralize('skill', removed.length)} removed`
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(', ');
}

function pluralize(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
}

interface ProfileAnalysisErrorProps {
  code: string | null;
  failure?: ErrorRecord | null;
  message: string;
  onBack?: () => void;
  onRetry?: () => void;
  platformUrl?: string;
}

export function ProfileAnalysisError({
  code,
  failure = null,
  message,
  onBack,
  onRetry,
  platformUrl: platformUrlProp,
}: ProfileAnalysisErrorProps) {
  const { t } = useI18n();
  const appUrl = useAppUrl();
  const platformUrl = platformUrlProp ?? appUrl;

  const actionable =
    code === 'NO_ACTIVE_GOAL'
      ? {
          label: t('profile.error.configureGoal'),
          path: GOALS_PATH,
          title: t('profile.error.goalTitle'),
        }
      : code === 'CONTEXT_INCOMPLETE'
        ? {
            label: t('profile.error.reviewContext'),
            path: CONTEXT_CONFIRMATION_PATH,
            title: t('profile.error.contextTitle'),
          }
        : null;

  return (
    <div className="space-y-4" data-profile-screen="error">
      <PageHeading icon={UserRound} title={t('profile.title')} />
      <Card className="rounded-2xl border-border/70 shadow-[0_18px_40px_-34px_var(--profile-shadow)]" role="alert">
        <CardContent className="pt-4">
          <span className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <CircleAlert className="size-5" />
          </span>
          <h2 className="mt-3 text-sm font-semibold">
            {actionable?.title ?? t('profile.error.generic')}
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {message}
          </p>
          {failure ? <ErrorReference className="mt-2" failure={failure} /> : null}
          <div className="mt-4 flex flex-col gap-2">
            {actionable ? (
              <Button asChild>
                <a
                  href={buildPlatformDeepLink(actionable.path, platformUrl)}
                  rel="noreferrer"
                  target="_blank"
                >
                  {actionable.label} <ArrowUpRight />
                </a>
              </Button>
            ) : onRetry ? (
              <Button onClick={onRetry}>{t('common.tryAgain')}</Button>
            ) : null}
            {onBack ? (
              <Button onClick={onBack} variant="ghost">
                <ArrowLeft /> {t('profile.error.back')}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function RecommendationDetail({
  analysisId,
  onBack,
  recommendation,
}: {
  analysisId: string;
  onBack: () => void;
  recommendation: ProfileRecommendation;
}) {
  const { getToken } = useConnection();
  const { t } = useI18n();
  const sectionLabels = profileSectionLabels(t);
  const embeddedSuggestion = embeddedFillSuggestion(recommendation);
  const requestedInitialSuggestion = useRef(false);
  const [suggestion, setSuggestion] = useState<ProfileSuggestion | null>(
    embeddedSuggestion,
  );
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [suggestionErrorCode, setSuggestionErrorCode] = useState<string | null>(
    null,
  );
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const requestSuggestion = useCallback(
    () =>
      profileService.createSuggestion(
        analysisId,
        recommendation.section,
        getToken,
        null,
      ),
    [analysisId, getToken, recommendation.section],
  );

  const loadSuggestion = useCallback(async () => {
    setIsSuggestionLoading(true);
    setCopyMessage(null);
    setSuggestionErrorCode(null);
    const result = await requestSuggestionKeepingCurrent(
      suggestion,
      requestSuggestion,
    );
    setSuggestion(result.suggestion);
    setSuggestionError(result.error);
    setSuggestionErrorCode(result.errorCode);
    setIsSuggestionLoading(false);
  }, [requestSuggestion, suggestion]);

  useEffect(() => {
    if (embeddedSuggestion) return;
    if (requestedInitialSuggestion.current) return;
    requestedInitialSuggestion.current = true;
    void loadSuggestion();
  }, [embeddedSuggestion, loadSuggestion]);

  const copySuggestion = useCallback(async () => {
    if (!suggestion || suggestion.kind !== 'rewrite') return;

    setSuggestionError(null);
    setSuggestionErrorCode(null);
    try {
      await copyProfileSuggestion(
        suggestion,
        navigator.clipboard,
        (recommendationId) =>
          profileService.updateRecommendationStatus(
            recommendationId,
            'copied',
            getToken,
          ),
      );
      setCopyMessage(t('proposal.copied'));
    } catch (error: unknown) {
      setSuggestionError(
        error instanceof Error ? error.message : t('common.copyFailed'),
      );
    }
  }, [getToken, suggestion, t]);

  return (
    <div
      className="grid min-w-0 gap-4 min-[760px]:grid-cols-12"
      data-profile-screen="suggestion"
    >
      <Button className="-ml-2 justify-self-start min-[760px]:col-span-12" onClick={onBack} size="sm" variant="ghost">
        <ArrowLeft /> {t('profile.backResults')}
      </Button>
      <div className="min-[760px]:col-span-12">
        <PageHeading
          description={t('profile.suggestionDescription')}
          icon={UserRound}
          title={sectionLabels[recommendation.section]}
        />
      </div>
      <div className="min-w-0 min-[760px]:col-span-5">
        <Card className="rounded-2xl border-border/70 shadow-[0_18px_40px_-34px_var(--profile-shadow)]">
          <CardContent className="space-y-2 pt-4">
            <p className="text-sm leading-relaxed">{recommendation.reason}</p>
            <EvidenceList evidence={recommendation.evidence} />
          </CardContent>
        </Card>
      </div>
      <div className="min-w-0 min-[760px]:col-span-7">
        {suggestion ? (
          <ProfileSuggestionContent
            copyMessage={copyMessage}
            error={suggestionError}
            onCopy={() => void copySuggestion()}
            suggestion={suggestion}
          />
        ) : (
          <Card
            className="rounded-2xl border-border/70 shadow-[0_18px_40px_-34px_var(--profile-shadow)]"
            role={suggestionError ? 'alert' : undefined}
          >
            <CardContent className="space-y-4 pt-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="warning">
                {profileImpactLabel(recommendation.impact, t)}
              </Badge>
              <Badge variant="outline">
                <Clock3 />{' '}
                {t('profile.minutes', {
                  count: recommendation.estimatedMinutes,
                })}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed">
              {recommendation.recommendation}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {recommendation.reason}
            </p>
            {isSuggestionLoading ? (
              <p className="flex items-center gap-2 text-xs font-medium text-primary-strong">
                <LoaderCircle className="size-4 animate-spin" />{' '}
                {t('profile.generating')}
              </p>
            ) : null}
            {suggestionError ? (
              <div>
                <p className="text-xs text-destructive">{suggestionError}</p>
                <Button className="mt-3" onClick={() => void loadSuggestion()} size="sm">
                  {t('common.tryAgain')}
                </Button>
              </div>
            ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface ProfileSuggestionContentProps {
  copyMessage: string | null;
  error: string | null;
  onCopy: () => void;
  suggestion: ProfileSuggestion;
}

export function ProfileSuggestionContent({
  copyMessage,
  error,
  onCopy,
  suggestion,
}: ProfileSuggestionContentProps) {
  const { t } = useI18n();

  return (
    <Card className="rounded-2xl border-border/70 shadow-[0_18px_40px_-34px_var(--profile-shadow)]" data-profile-suggestion>
      <CardContent className="space-y-4 pt-4">
        <Badge variant="warning">
          {profileImpactLabel(suggestion.impact, t)}
        </Badge>

        <ResolvedFieldNotice suggestion={suggestion} />

        {suggestion.kind === 'rewrite' ? (
          <>
            <SuggestionValue
              fallback={t('profile.noCurrent')}
              label={t('profile.current')}
              muted
              value={suggestion.originalValue}
            />
            <SuggestionValue
              fallback={t('profile.noRecommendation')}
              label={t('profile.recommended')}
              value={suggestion.suggestedValue}
            />
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {t('profile.recommendations')}
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                {suggestion.guidance}
              </p>
            </div>
            <ul className="space-y-2" aria-label={t('profile.itemsToAdd')}>
              {suggestion.items.map((item) => (
                <li
                  className="flex gap-2 rounded-lg border border-border/80 p-3 text-sm leading-relaxed"
                  key={item}
                >
                  <span aria-hidden="true" className="text-primary-strong">
                    +
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-lg bg-muted/55 p-3">
          <p className="text-xs font-semibold">{t('profile.why')}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {suggestion.explanation}
          </p>
        </div>

        {/* Insert ships disabled by design (spec 2.3): the product never writes
            to an Upwork form. A permanently greyed-out button only advertises a
            feature that is not coming, so Copy is the whole affordance. */}
        {suggestion.kind === 'rewrite' ? (
          <Button className="w-full" onClick={onCopy}>
            <Copy /> {t('proposal.copy')}
          </Button>
        ) : null}
        {copyMessage ? (
          <p className="text-xs font-medium text-success" role="status">
            <Check className="mr-1 inline size-3.5" /> {copyMessage}
          </p>
        ) : null}
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function isCompletenessRecommendation(
  recommendation: ProfileRecommendation,
): recommendation is ProfileCompletenessRecommendation {
  return recommendation.kind === 'fill';
}

function embeddedFillSuggestion(
  recommendation: ProfileRecommendation,
): ProfileSuggestion | null {
  if (!isCompletenessRecommendation(recommendation)) return null;

  return {
    id: recommendation.id,
    section: recommendation.section,
    kind: 'fill',
    field: null,
    itemIndex: null,
    guidance: recommendation.guidance,
    items: recommendation.items,
    explanation: recommendation.reason,
    impact: recommendation.impact,
  };
}

function ResolvedFieldNotice({
  suggestion,
}: {
  suggestion: ProfileSuggestion;
}) {
  if (suggestion.field === null) return null;

  const resolvesToDifferentField = suggestion.section !== suggestion.field;
  if (!resolvesToDifferentField && suggestion.itemIndex === null) return null;

  const itemLabel =
    suggestion.itemIndex === null ? '' : ` entry ${suggestion.itemIndex + 1}`;
  return (
    <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
      {resolvesToDifferentField
        ? `This ${SECTION_LABELS[suggestion.section]} priority targets your `
        : 'This recommendation targets your '}
      <span className="font-semibold text-foreground">
        {SUGGESTION_FIELD_LABELS[suggestion.field]}
        {itemLabel}
      </span>
      .
    </p>
  );
}

function SuggestionValue({
  fallback,
  label,
  muted = false,
  value,
}: {
  fallback: string;
  label: string;
  muted?: boolean;
  value?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-2 whitespace-pre-wrap rounded-lg border border-border/80 p-3 text-sm leading-relaxed',
          muted && 'bg-muted/35 text-muted-foreground',
        )}
      >
        {value ?? fallback}
      </p>
    </div>
  );
}

function ProfileLoadError({
  failure = null,
  message,
  onRetry,
}: {
  failure?: ErrorRecord | null;
  message: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-5">
      <PageHeading icon={UserRound} title={t('profile.title')} />
      <Card className="rounded-2xl border-border/70 shadow-[0_18px_40px_-34px_var(--profile-shadow)]" role="alert">
        <CardContent className="pt-4">
          <p className="text-sm font-semibold">
            {t('profile.loadErrorTitle')}
          </p>
          <p className="mt-1 text-xs text-destructive">{message}</p>
          {failure ? <ErrorReference className="mt-2" failure={failure} /> : null}
          <Button className="mt-4" onClick={onRetry} size="sm">
            {t('common.tryAgain')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-3 first:border-b first:border-primary/12 min-[320px]:first:border-r min-[320px]:first:border-b-0">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-semibold">{value}</p>
    </div>
  );
}

function EntryIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
      {children}
    </span>
  );
}

interface SetupRequirement {
  action: ReactNode;
  help: string;
  id: 'context' | 'goal' | 'profile';
  label: string;
  state: ProfilePageState;
}

/** The amber "do this next" surface shared by setup and re-analysis. */
function ActionNotice({
  action = null,
  help,
  id,
  label,
}: {
  action?: ReactNode;
  help: string;
  id?: string;
  label: string;
}) {
  return (
    <div
      className="flex gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5"
      id={id}
    >
      <CircleAlert
        aria-hidden
        className="mt-px size-4 shrink-0 text-warning-foreground"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-snug text-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {help}
        </p>
        {action ? <div className="mt-2 text-xs">{action}</div> : null}
      </div>
    </div>
  );
}

function RecheckPageButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();

  return (
    <button
      className="inline-flex items-center gap-1 font-semibold text-primary-strong outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/35"
      onClick={onClick}
      type="button"
    >
      <RotateCw aria-hidden className="size-3.5" />
      {t('profile.setup.recheck')}
    </button>
  );
}

/**
 * A missing step is the one thing the user has to act on, so it gets the
 * warning surface, the reason, and the fix. Met steps collapse to one quiet
 * line so they never compete with it.
 */
function SetupRequirementRow({
  requirement,
}: {
  requirement: SetupRequirement;
}) {
  const { action, help, id, label, state } = requirement;

  if (state === 'missing') {
    return (
      <li data-requirement={id} data-requirement-state={state}>
        <ActionNotice action={action} help={help} label={label} />
      </li>
    );
  }

  return (
    <li
      className="flex items-center gap-2.5 px-3 text-xs text-muted-foreground"
      data-requirement={id}
      data-requirement-state={state}
    >
      {state === 'checking' ? (
        <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin" />
      ) : (
        <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
      )}
      {label}
    </li>
  );
}

function formatDelta(delta: number, t: Translate): string {
  if (delta === 0) return t('profile.noChange');
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function ProfileSkeleton() {
  const { t } = useI18n();

  return (
    <div className="space-y-4" aria-label={t('profile.loading')}>
      <div className="space-y-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-full" />
      </div>
      <Skeleton className="h-80 rounded-none" />
      <Skeleton className="h-28 rounded-none" />
    </div>
  );
}
