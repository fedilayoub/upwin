import {
  Check,
  Clipboard,
  Code2,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  Scissors,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { TranslationKey } from '@/features/i18n/dictionaries/en';
import { useI18n } from '@/features/i18n/i18n-context';
import type {
  ProposalBlockId,
  ProposalRefinement,
  ScreeningQuestion,
} from '@/types/proposal';
import type {
  BlockFeedback,
  RefinementErrorDetails,
} from './proposal-context';

const refinements: Array<{
  icon: typeof Scissors;
  labelKey: TranslationKey;
  value: ProposalRefinement;
}> = [
  { icon: Scissors, labelKey: 'proposal.shorter', value: 'shorter' },
  { icon: Code2, labelKey: 'proposal.moreTechnical', value: 'more-technical' },
  {
    icon: MessageCircle,
    labelKey: 'proposal.moreConversational',
    value: 'more-conversational',
  },
  { icon: RotateCcw, labelKey: 'proposal.tryAnother', value: 'regenerate' },
];

export interface DraftBlockActions {
  copyFeedback: (blockId: ProposalBlockId) => BlockFeedback;
  isRefining: (
    blockId: ProposalBlockId,
    refinement: ProposalRefinement,
  ) => boolean;
  onCopy: (blockId: ProposalBlockId) => void;
  onRefine: (
    blockId: ProposalBlockId,
    refinement: ProposalRefinement,
  ) => void;
  onTextChange: (blockId: ProposalBlockId, text: string) => void;
  refinementPending: boolean;
  refinementError: (
    blockId: ProposalBlockId,
  ) => RefinementErrorDetails | null;
  text: (blockId: ProposalBlockId) => string;
}

export function ScreeningQuestionCard({
  actions,
  question,
}: {
  actions: DraftBlockActions;
  question: ScreeningQuestion;
}) {
  const { t } = useI18n();

  return (
    <Card data-screening-answer={question.blockId}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="leading-snug">{question.question}</CardTitle>
          <Badge className="shrink-0" variant="outline">
            {t('proposal.wordCount', { count: question.wordCount })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <label className="sr-only" htmlFor={`draft-${question.blockId}`}>
          {t('proposal.answerTo', { question: question.question })}
        </label>
        <Textarea
          className="min-h-32"
          id={`draft-${question.blockId}`}
          onChange={(event) =>
            actions.onTextChange(question.blockId, event.target.value)
          }
          value={actions.text(question.blockId)}
        />
        <DraftBlockControls
          actions={actions}
          blockId={question.blockId}
        />
      </CardContent>
    </Card>
  );
}

export function DraftBlockControls({
  actions,
  blockId,
}: {
  actions: DraftBlockActions;
  blockId: ProposalBlockId;
}) {
  const { t } = useI18n();
  const feedback = actions.copyFeedback(blockId);
  const refinementError = actions.refinementError(blockId);

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {refinements.map(({ icon: Icon, labelKey, value }) => {
          const loading = actions.isRefining(blockId, value);
          return (
            <Button
              disabled={actions.refinementPending}
              key={value}
              onClick={() => actions.onRefine(blockId, value)}
              size="sm"
              variant={value === 'shorter' ? 'outline' : 'ghost'}
            >
              {loading ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Icon />
              )}
              {t(labelKey)}
            </Button>
          );
        })}
      </div>

      {refinementError ? (
        <p className="mt-3 text-xs text-destructive" role="alert">
          {refinementError.message}
        </p>
      ) : null}

      <div className="mt-4 border-t border-border pt-4">
        <Button
          className="w-full"
          onClick={() => actions.onCopy(blockId)}
          variant="secondary"
        >
          {feedback.status === 'copied' ? <Check /> : <Clipboard />}
          {feedback.status === 'copied'
            ? t('proposal.copied')
            : t('proposal.copy')}
        </Button>
      </div>

      {feedback.message ? (
        <p
          className={`mt-2 text-xs ${
            feedback.status === 'error'
              ? 'text-destructive'
              : 'text-success'
          }`}
          role={feedback.status === 'error' ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      ) : null}
    </>
  );
}
