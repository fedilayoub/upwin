import {
  ArrowRight,
  DatabaseZap,
  FileText,
  Gauge,
  PenLine,
  ScanSearch,
} from 'lucide-react';
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
  type ChainOfThoughtStepStatus,
} from '@/components/ai/chain-of-thought';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n, type Translate } from '@/features/i18n/i18n-context';
import type { Locale } from '@/features/i18n/locale';
import type { JobAnalysis, JobCaptureResult } from '@/types/job';
import type { Proposal } from '@/types/proposal';
import { DraftStageOrb } from './draft-stage-orb';
import { jobCaptureChips, matchChips } from './draft-evidence';
import type { DraftFlowStage } from './use-draft-flow';

export const DRAFT_FLOW_STAGES = [
  'capture',
  'persist',
  'analysis',
  'draft',
] as const satisfies ReadonlyArray<DraftFlowStage>;

const DRAFT_FLOW_STAGE_ICONS = {
  analysis: Gauge,
  capture: ScanSearch,
  draft: PenLine,
  persist: DatabaseZap,
} as const;

interface DraftChainOfThoughtProps {
  analysis: JobAnalysis | null;
  capture: JobCaptureResult | null;
  draft: Proposal | null;
  failedStage: DraftFlowStage | null;
  onViewProposal?: () => void;
  stage: DraftFlowStage | null;
}

export function DraftChainOfThought({
  analysis,
  capture,
  draft,
  failedStage,
  onViewProposal,
  stage,
}: DraftChainOfThoughtProps) {
  const { locale, t } = useI18n();
  const headerStage = stage ?? failedStage;
  const header = draft
    ? t('draft.flow.ready')
    : headerStage
      ? `${draftStageLabel(headerStage, t)}${stage ? '…' : ''}`
      : t('draft.flow.progress');

  return (
    <Card aria-live="polite" data-draft-chain-of-thought>
      <CardContent className="pt-4">
        <ChainOfThought defaultOpen>
          <ChainOfThoughtHeader>{header}</ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            {DRAFT_FLOW_STAGES.map((flowStage, index) => {
              const status = stageStatus({
                draft,
                failedStage,
                index,
                stage,
              });
              const chips = stageChips(flowStage, analysis, capture, draft, t);
              const description = stageDescription(
                flowStage,
                analysis,
                capture,
                locale,
                t,
              );

              return (
                <ChainOfThoughtStep
                  data-flow-stage={flowStage}
                  description={description}
                  icon={DRAFT_FLOW_STAGE_ICONS[flowStage]}
                  indicator={
                    status === 'active' && stage ? (
                      <DraftStageOrb size={20} stage={stage} />
                    ) : undefined
                  }
                  key={flowStage}
                  label={draftStageLabel(flowStage, t)}
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
        {draft && onViewProposal ? (
          <Button
            className="mt-4 w-full"
            data-proposal-ready-action
            onClick={onViewProposal}
          >
            <FileText /> {t('draft.flow.view')} <ArrowRight />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function stageStatus({
  draft,
  failedStage,
  index,
  stage,
}: {
  draft: Proposal | null;
  failedStage: DraftFlowStage | null;
  index: number;
  stage: DraftFlowStage | null;
}): ChainOfThoughtStepStatus {
  if (draft) return 'complete';

  const currentStage = stage ?? failedStage;
  if (!currentStage) return 'pending';
  const currentIndex = DRAFT_FLOW_STAGES.indexOf(currentStage);
  if (index < currentIndex) return 'complete';
  if (stage && index === currentIndex) return 'active';
  return 'pending';
}

function stageChips(
  stage: DraftFlowStage,
  analysis: JobAnalysis | null,
  capture: JobCaptureResult | null,
  draft: Proposal | null,
  t: Translate,
): string[] {
  if (stage === 'capture' && capture) return jobCaptureChips(capture);
  if (stage === 'analysis' && analysis) return matchChips(analysis);
  if (stage === 'draft' && draft) {
    return [
      t('draft.flow.words', { count: draft.proposal.wordCount }),
      t(
        draft.answers.length === 1
          ? 'draft.flow.answerOne'
          : 'draft.flow.answerMany',
        { count: draft.answers.length },
      ),
    ];
  }
  return [];
}

function stageDescription(
  stage: DraftFlowStage,
  analysis: JobAnalysis | null,
  capture: JobCaptureResult | null,
  locale: Locale,
  t: Translate,
): string | undefined {
  if (stage === 'capture') {
    return t('draft.flow.finite');
  }
  if (stage === 'persist' && capture) {
    return t('draft.flow.captured', {
      date: formatCapturedAt(capture.snapshot.capturedAt, locale),
    });
  }
  if (stage === 'draft' && analysis) {
    return t('draft.flow.matchReady', { score: analysis.matchScore });
  }
  return undefined;
}

function formatCapturedAt(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function draftStageLabel(
  stage: DraftFlowStage,
  t: Translate,
): string {
  const keys: Record<DraftFlowStage, Parameters<Translate>[0]> = {
    analysis: 'draft.flow.analysis',
    capture: 'draft.flow.capture',
    draft: 'draft.flow.draft',
    persist: 'draft.flow.persist',
  };
  return t(keys[stage]);
}
