import { serializePromptData } from '../profile-analyzer/prompt-data';
import type {
  ProposalRefinement,
  ProposalRefinementContext,
} from './prompt-data';

const REFINEMENT_DIRECTIVES: Readonly<Record<ProposalRefinement, string>> = {
  regenerate: 'write it again from a different angle',
  shorter: 'cut its length while keeping the strongest evidence',
  'more-technical': 'raise its technical specificity',
  'more-conversational': 'make it warmer and more conversational',
};

export function renderRefinement(
  refinement: ProposalRefinementContext,
): string {
  return `REFINEMENT REQUEST
Rewrite only ${refinement.blockId}: ${REFINEMENT_DIRECTIVES[refinement.refinement]}. Return the complete schema so positions remain verifiable; unchanged blocks are context and will not replace persisted blocks.
The rewrite must still satisfy any USER INSTRUCTIONS given in this prompt.
<existing_draft>
${serializePromptData(refinement.existingDraft)}
</existing_draft>`;
}
