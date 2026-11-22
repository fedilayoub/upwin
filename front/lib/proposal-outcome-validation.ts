import {
  PROPOSAL_OUTCOME_STATUSES,
  type PutProposalOutcomeInput,
} from '@/lib/api';

export type ProposalOutcomeValidationResult =
  | { success: true; data: PutProposalOutcomeInput }
  | { success: false; errors: { status: 'invalidChoice' } };

export function validateProposalOutcomeInput(
  input: string,
): ProposalOutcomeValidationResult {
  const status = PROPOSAL_OUTCOME_STATUSES.find(
    (candidate) => candidate === input,
  );
  if (!status) return { success: false, errors: { status: 'invalidChoice' } };
  return { success: true, data: { status } };
}

export function rawProposalOutcomeInput(formData: FormData): string {
  const value = formData.get('status');
  return typeof value === 'string' ? value : '';
}
