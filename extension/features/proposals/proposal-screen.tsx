import { ProposalVideo } from "@/features/recording/ui/proposal-video";
import type { VideoIntent } from "@/features/recording/ui/new-recording";
import { ErrorReference } from "@/components/shared/error-notice";
import type { ErrorRecord } from "@/features/diagnostics/errors";
import { useState, type ReactNode } from "react";
import {
  FilePenLine,
  MessageCircleQuestionMark,
  PenLine,
} from "lucide-react";
import { PageHeading } from "@/components/shared/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PageState } from "@/features/extension/use-page-status";
import { JobEntryCard } from "@/features/jobs/job-entry-card";
import { useJobPageStatus } from "@/features/jobs/use-job-page-status";
import { Textarea } from "@/components/ui/textarea";
import { useConnection } from "@/features/connection/connection-context";
import type { TranslationKey } from "@/features/i18n/dictionaries/en";
import { useI18n } from "@/features/i18n/i18n-context";
import { insightsService } from "@/services/insights";
import type { ProposalOutcomeStatus } from "@/types/insights";
import type { JobAnalysis, JobCaptureResult } from "@/types/job";
import type { Proposal } from "@/types/proposal";
import { DraftChainOfThought, draftStageLabel } from "./draft-chain-of-thought";
import { ProposalActivity } from "./proposal-activity";
import { useProposal } from "./proposal-context";
import {
  type DraftFlowStage,
} from "./use-draft-flow";
import {
  DraftBlockControls,
  ScreeningQuestionCard,
  type DraftBlockActions,
} from "./screening-question-card";

export function ProposalScreen({
  onRecordVideo,
}: { onRecordVideo?: (intent: VideoIntent) => void } = {}) {
  const {
    blockText,
    copyBlock,
    copyFeedback,
    flow,
    isRefining,
    refinementError,
    refinementPending,
    refineBlock,
    retry,
    setBlockText,
    start,
  } = useProposal();
  const pageStatus = useJobPageStatus();

  const actions: DraftBlockActions = {
    copyFeedback,
    isRefining,
    onCopy: (blockId) => void copyBlock(blockId),
    onRefine: (blockId, refinement) => void refineBlock(blockId, refinement),
    onTextChange: setBlockText,
    refinementPending,
    refinementError,
    text: blockText,
  };

  if (!flow.draft) {
    // Proposal activity sits under the start card, and steps aside while a draft is in progress.
    const idle = flow.stage === null && !flow.failedStage;
    return (
      <div className="space-y-5">
        <ProposalEntry
          analysis={flow.analysis}
          capture={flow.capture}
          error={flow.error}
          errorCode={flow.errorCode}
          failure={flow.failure}
          failedStage={flow.failedStage}
          onRecheckPage={pageStatus.recheck}
          onRetry={() => void retry()}
          onStart={() => void start()}
          pageState={pageStatus.status}
          stage={flow.stage}
        />
        {idle ? <ProposalActivity /> : null}
      </div>
    );
  }

  return (
    <ProposalDraftView
      actions={actions}
      draft={flow.draft}
      videoActions={
        onRecordVideo && flow.analysis ? (
          <ProposalVideo
            jobSnapshotId={flow.analysis.jobSnapshotId}
            jobTitle={flow.capture?.snapshot.job.title ?? ""}
            proposalText={blockText("proposal")}
            onRecord={onRecordVideo}
          />
        ) : undefined
      }
      progress={
        <DraftChainOfThought
          analysis={flow.analysis}
          capture={flow.capture}
          draft={flow.draft}
          failedStage={flow.failedStage}
          stage={flow.stage}
        />
      }
    />
  );
}

export function ProposalEntry({
  analysis,
  capture,
  error,
  errorCode,
  failure = null,
  failedStage,
  onRecheckPage,
  onRetry,
  onStart,
  pageState,
  stage,
}: {
  analysis: JobAnalysis | null;
  capture: JobCaptureResult | null;
  error: string | null;
  errorCode: string | null;
  failure?: ErrorRecord | null;
  failedStage: DraftFlowStage | null;
  onRecheckPage?: () => void;
  onRetry: () => void;
  onStart: () => void;
  /** Whether the active tab is a supported job post. Gates the start button. */
  pageState: PageState;
  stage: DraftFlowStage | null;
}) {
  const { locale, t } = useI18n();

  return (
    <div className="space-y-5">
      <PageHeading
        description={t("proposal.entryDescription")}
        icon={FilePenLine}
        title={t("proposal.title")}
      />

      {stage || failedStage ? (
        <DraftChainOfThought
          analysis={analysis}
          capture={capture}
          draft={null}
          failedStage={failedStage}
          stage={stage}
        />
      ) : null}

      {error && failedStage ? (
          <Card>
            <CardContent className="space-y-3 pt-4">
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
              {failure ? <ErrorReference failure={failure} /> : null}
              {analysis ? (
                <p className="text-xs text-muted-foreground">
                  {t("proposal.matchStillAvailable", {
                    score: analysis.matchScore,
                  })}
                </p>
              ) : null}
              <Button onClick={onRetry} variant="outline">
                {t("job.retryStage", {
                  stage: draftStageLabel(failedStage, t).toLocaleLowerCase(
                    locale,
                  ),
                })}
              </Button>
            </CardContent>
          </Card>
      ) : null}

      {stage === null && !error ? (
        <JobEntryCard
          help={t("proposal.entryHelp")}
          icon={PenLine}
          onRecheckPage={onRecheckPage}
          onStart={onStart}
          pageState={pageState}
          title={t("proposal.entryTitle")}
        />
      ) : null}
    </div>
  );
}

export function ProposalDraftView({
  actions,
  draft,
  progress,
  videoActions,
}: {
  actions: DraftBlockActions;
  draft: Proposal;
  progress?: ReactNode;
  videoActions?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div
      className="grid min-w-0 gap-5 min-[760px]:grid-cols-12"
      data-proposal-draft
    >
      <div className="flex items-start justify-between gap-3 min-[760px]:col-span-12">
        <PageHeading
          description={t("proposal.editDescription")}
          icon={FilePenLine}
          title={t("proposal.title")}
        />
        <Badge className="mt-1 shrink-0" variant="success">
          {t("proposal.ready")}
        </Badge>
      </div>

      {progress ? (
        <div className="min-w-0 min-[760px]:col-span-12">{progress}</div>
      ) : null}

      <div className="min-w-0 min-[760px]:col-span-7">
        <Card className="h-full" data-proposal-block>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{t("proposal.proposal")}</CardTitle>
            <Badge variant="outline">
              {t("proposal.wordCount", { count: draft.proposal.wordCount })}
            </Badge>
          </CardHeader>
          <CardContent>
            <label className="sr-only" htmlFor="proposal-content">
              {t("proposal.content")}
            </label>
            <Textarea
              id="proposal-content"
              onChange={(event) =>
                actions.onTextChange("proposal", event.target.value)
              }
              value={actions.text("proposal")}
            />
            <DraftBlockControls actions={actions} blockId="proposal" />
            {videoActions}
          </CardContent>
        </Card>
      </div>

      <div className="min-w-0 min-[760px]:col-span-5">
        <ProposalOutcomeControl analysisId={draft.jobAnalysisId} />
      </div>

      <section
        aria-labelledby="screening-heading"
        className="space-y-3 min-[760px]:col-span-12"
      >
        <div>
          <div className="flex items-center gap-2">
            <MessageCircleQuestionMark className="size-4 text-primary-strong" />
            <h2 className="text-sm font-semibold" id="screening-heading">
              {t("proposal.screening")}
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("proposal.screeningHelp")}
          </p>
        </div>

        {draft.answers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              {t("proposal.noScreening")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 min-[760px]:grid-cols-2">
            {draft.answers.map((question) => (
              <ScreeningQuestionCard
                actions={actions}
                key={question.blockId}
                question={question}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Pipeline order, matching the web board and the contract. `sent` is shown as
 * "Applied" — the wire value is deliberately not the label.
 */
const OUTCOME_OPTIONS = [
  { labelKey: "outcome.in-progress", status: "in-progress" },
  { labelKey: "outcome.sent", status: "sent" },
  { labelKey: "outcome.viewed", status: "viewed" },
  { labelKey: "outcome.messaged", status: "messaged" },
  { labelKey: "outcome.interviewing", status: "interviewing" },
  { labelKey: "outcome.hired", status: "hired" },
  { labelKey: "outcome.declined", status: "declined" },
  { labelKey: "outcome.no-response", status: "no-response" },
] as const satisfies ReadonlyArray<{
  labelKey: TranslationKey;
  status: ProposalOutcomeStatus;
}>;

export function ProposalOutcomeControl({ analysisId }: { analysisId: string }) {
  const { getToken } = useConnection();
  const { t } = useI18n();
  // Drafting enrols the job at `in-progress` on the backend, so that is the
  // truth the moment this renders. The panel never reads the board back.
  const [status, setStatus] = useState<ProposalOutcomeStatus>("in-progress");
  const [pendingStatus, setPendingStatus] =
    useState<ProposalOutcomeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateOutcome = async (nextStatus: ProposalOutcomeStatus) => {
    if (pendingStatus !== null || nextStatus === status) return;
    const previousStatus = status;
    setStatus(nextStatus);
    setPendingStatus(nextStatus);
    setError(null);

    try {
      const outcome = await insightsService.putProposalOutcome(
        analysisId,
        nextStatus,
        getToken,
      );
      setStatus(outcome.status);
    } catch (updateError: unknown) {
      setStatus(previousStatus);
      setError(
        updateError instanceof Error
          ? updateError.message
          : t("proposal.saveError"),
      );
    } finally {
      setPendingStatus(null);
    }
  };

  const isApplying = pendingStatus === "sent";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("proposal.applyTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "in-progress" ? (
          <>
            <Button
              className="w-full"
              disabled={pendingStatus !== null}
              onClick={() => void updateOutcome("sent")}
              type="button"
            >
              {isApplying ? t("proposal.saving") : t("proposal.markApplied")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("proposal.trackerHelp")}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("proposal.trackedAs", { status: labelFor(status, t) })}
          </p>
        )}

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function labelFor(
  status: ProposalOutcomeStatus,
  t: ReturnType<typeof useI18n>["t"],
): string {
  return OUTCOME_OPTIONS.find((option) => option.status === status)?.labelKey
    ? t(OUTCOME_OPTIONS.find((option) => option.status === status)!.labelKey)
    : status;
}
