import { resolveWordBudget } from '../../../proposal-preferences/word-budgets';
import type { ProposalPreferencesResponse } from '../../../proposal-preferences/proposal-preferences.service';
import { serializePromptData } from '../profile-analyzer/prompt-data';

export function renderProposalPreferences(
  preferences: ProposalPreferencesResponse,
): string {
  return `PREFERENCES
The target is guidance. The hard ceiling is mandatory.
<proposal_preferences>
${serializePromptData({
  tone: preferences.proposalTone,
  language: preferences.language,
  signOffName: preferences.signOffName,
  proposalWordBudget: resolveWordBudget(preferences.proposalLength),
  answerWordBudget: resolveWordBudget(preferences.answerLength),
})}
</proposal_preferences>`;
}
