import type { OutputLanguage } from '../../../proposal-preferences/proposal-preferences.schema';
import { resolveWordBudget } from '../../../proposal-preferences/word-budgets';
import type { ProposalPreferencesResponse } from '../../../proposal-preferences/proposal-preferences.service';
import { serializePromptData } from '../profile-analyzer/prompt-data';

/**
 * The language's English name. A bare ISO code buried in the data block was
 * not enough: with an English system prompt, English context and English
 * screening questions, the model drifted back to English.
 */
const LANGUAGE_NAMES: Record<OutputLanguage, string> = {
  en: 'English',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  it: 'Italian',
  nl: 'Dutch',
  pt: 'Portuguese',
};

export function renderProposalPreferences(
  preferences: ProposalPreferencesResponse,
): string {
  const language = LANGUAGE_NAMES[preferences.language];
  return `PREFERENCES
The target is guidance. The hard ceiling is mandatory.
Write the proposal and every screening answer in ${language}, even when the job post, the screening questions or the freelancer context use another language. Keep technology and product names as written.
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
