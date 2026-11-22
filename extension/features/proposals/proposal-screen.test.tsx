import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Proposal, ProposalBlockId } from '@/types/proposal';

vi.mock('@/features/connection/connection-context', () => ({
  useConnection: () => ({ getToken: vi.fn() }),
}));

import {
  copyDraftText,
  mergeRefinedDraftTexts,
  textsFromDraft,
} from './proposal-context';
import { ProposalDraftView, ProposalEntry } from './proposal-screen';
import type { DraftBlockActions } from './screening-question-card';

const draft: Proposal = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa13',
  jobAnalysisId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa11',
  proposal: {
    blockId: 'proposal',
    text: 'Original proposal.',
    wordCount: 2,
    variantIndex: 0,
  },
  answers: [
    {
      blockId: 'answer:0',
      position: 0,
      question: 'Which design systems have you used?',
      text: 'Original first answer.',
      wordCount: 3,
      variantIndex: 0,
    },
    {
      blockId: 'answer:1',
      position: 1,
      question: 'How do you validate accessibility?',
      text: 'Original second answer.',
      wordCount: 3,
      variantIndex: 0,
    },
  ],
  versions: {
    prompt: 'proposal-writer-v1',
    requestedModel: 'gpt-4.1-mini',
    gateway: 'llmgateway',
    provider: 'openai',
    model: 'openai/gpt-4.1-mini',
  },
  createdAt: '2026-08-23T12:00:03.000Z',
};

describe('ProposalDraftView', () => {
  it('renders a calm empty state and no answer cards for zero questions', () => {
    const markup = renderToStaticMarkup(
      <ProposalDraftView
        actions={actionsFor({ ...draft, answers: [] })}
        draft={{ ...draft, answers: [] }}
      />,
    );

    expect(markup).toContain('No screening questions on this job');
    expect(markup).not.toContain('data-screening-answer');
  });

  it('offers copy as the only handoff, with no Insert affordance', () => {
    const markup = renderToStaticMarkup(
      <ProposalDraftView actions={actionsFor(draft)} draft={draft} />,
    );

    // Insert into Upwork was never wired up; a permanently disabled button
    // only advertised a capability the panel does not have.
    expect(markup).not.toContain('Insert');
    expect(markup.match(/>Copy<\/button>/g)).toHaveLength(3);
    expect(markup).toContain('data-proposal-draft');
    expect(markup).toContain('min-[760px]:grid-cols-12');
  });

  it('offers to mark the job applied below a generated draft', () => {
    const markup = renderToStaticMarkup(
      <ProposalDraftView actions={actionsFor(draft)} draft={draft} />,
    );

    // Drafting enrols the job on the tracker, so the question is no longer
    // "what happened" but the single next step the user has to confirm.
    expect(markup).toContain('Did you apply?');
    expect(markup).toContain('Mark as applied');
    expect(markup).not.toContain('aria-pressed');
  });

});

describe('ProposalEntry', () => {

  const entry = (pageState: 'checking' | 'missing' | 'ready') =>
    renderToStaticMarkup(
      <ProposalEntry
        analysis={null}
        capture={null}
        error={null}
        errorCode={null}
        failedStage={null}
        onRecheckPage={vi.fn()}
        onRetry={vi.fn()}
        onStart={vi.fn()}
        pageState={pageState}
        stage={null}
      />,
    );

  it('enables the start button on a job post', () => {
    const markup = entry('ready');

    expect(markup).toContain('Analyze job and draft');
    expect(markup).not.toContain('disabled=""');
  });

  it('disables the start button and names the page off a job post', () => {
    const markup = entry('missing');

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Open an Upwork job post in this tab');
    expect(markup).toContain('Check again');
  });

  it('keeps the start button disabled while the tab is being checked', () => {
    const markup = entry('checking');

    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('Check again');
  });
});

describe('proposal block interactions', () => {
  it('replaces only the refined answer and preserves local edits elsewhere', () => {
    const current = {
      ...textsFromDraft(draft),
      proposal: 'Locally edited proposal.',
      'answer:1': 'Locally edited second answer.',
    };
    const refined = {
      ...draft,
      answers: draft.answers.map((answer) =>
        answer.blockId === 'answer:0'
          ? { ...answer, text: 'Shorter first answer.', variantIndex: 1 }
          : answer,
      ),
    };

    expect(mergeRefinedDraftTexts(current, refined, 'answer:0')).toEqual({
      proposal: 'Locally edited proposal.',
      'answer:0': 'Shorter first answer.',
      'answer:1': 'Locally edited second answer.',
    });
  });

  it('copies the edited textarea value rather than the server text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const feedback = await copyDraftText('Locally edited proposal.', writeText);

    expect(writeText).toHaveBeenCalledWith('Locally edited proposal.');
    expect(writeText).not.toHaveBeenCalledWith(draft.proposal.text);
    expect(feedback.status).toBe('copied');
  });

  it('surfaces a clipboard rejection without a false confirmation', async () => {
    const feedback = await copyDraftText(
      'Selectable text',
      vi.fn().mockRejectedValue(new Error('denied')),
    );

    expect(feedback.status).toBe('error');
    expect(feedback.message).toContain('Select the text and copy it manually');
    expect(feedback.message).not.toContain('Copied');
  });
});

function actionsFor(proposal: Proposal): DraftBlockActions {
  const texts = textsFromDraft(proposal);
  return {
    copyFeedback: () => ({ message: null, status: 'idle' }),
    isRefining: () => false,
    onCopy: () => undefined,
    onRefine: () => undefined,
    onTextChange: () => undefined,
    refinementPending: false,
    refinementError: () => null,
    text: (blockId: ProposalBlockId) => texts[blockId] ?? '',
  };
}
