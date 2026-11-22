import {
  ANSWER_LENGTHS,
  OUTPUT_LANGUAGES,
  PROPOSAL_LENGTHS,
  PROPOSAL_TONES,
  type PutProposalPreferencesInput,
} from '@/lib/api';

export type ProposalPreferencesField =
  | 'proposalLength'
  | 'proposalTone'
  | 'answerLength'
  | 'language'
  | 'signOffName'
  | 'customInstructions';

export type ProposalPreferencesValidationCode = 'invalidChoice' | 'tooLong';

export interface RawProposalPreferencesInput {
  proposalLength: string;
  proposalTone: string;
  answerLength: string;
  language: string;
  signOffName: string;
  customInstructions: string;
}

export type ProposalPreferencesValidationResult =
  | { success: true; data: PutProposalPreferencesInput }
  | {
      success: false;
      errors: Partial<
        Record<
          ProposalPreferencesField,
          ProposalPreferencesValidationCode
        >
      >;
    };

export function validateProposalPreferencesInput(
  input: RawProposalPreferencesInput,
): ProposalPreferencesValidationResult {
  const errors: Partial<
    Record<ProposalPreferencesField, ProposalPreferencesValidationCode>
  > = {};
  const proposalLength = memberOf(input.proposalLength, PROPOSAL_LENGTHS);
  const proposalTone = memberOf(input.proposalTone, PROPOSAL_TONES);
  const answerLength = memberOf(input.answerLength, ANSWER_LENGTHS);
  const language = memberOf(input.language, OUTPUT_LANGUAGES);
  const signOffName = input.signOffName.trim();
  const customInstructions = input.customInstructions.trim();

  if (!proposalLength) errors.proposalLength = 'invalidChoice';
  if (!proposalTone) errors.proposalTone = 'invalidChoice';
  if (!answerLength) errors.answerLength = 'invalidChoice';
  if (!language) errors.language = 'invalidChoice';
  if (signOffName.length > 120) errors.signOffName = 'tooLong';
  if (customInstructions.length > 2_000) {
    errors.customInstructions = 'tooLong';
  }

  if (
    !proposalLength ||
    !proposalTone ||
    !answerLength ||
    !language ||
    Object.keys(errors).length > 0
  ) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      proposalLength,
      proposalTone,
      answerLength,
      language,
      signOffName,
      customInstructions,
    },
  };
}

export function rawProposalPreferencesInput(
  formData: FormData,
): RawProposalPreferencesInput {
  return {
    proposalLength: formText(formData, 'proposalLength'),
    proposalTone: formText(formData, 'proposalTone'),
    answerLength: formText(formData, 'answerLength'),
    language: formText(formData, 'language'),
    signOffName: formText(formData, 'signOffName'),
    customInstructions: formText(formData, 'customInstructions'),
  };
}

function memberOf<const Values extends readonly string[]>(
  value: string,
  values: Values,
): Values[number] | undefined {
  return values.find((candidate) => candidate === value);
}

function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}
