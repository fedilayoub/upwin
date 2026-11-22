import type { JobSnapshot } from '../../../job-snapshots/job-snapshot.schema';

export function renderProposalOutputNotes(snapshot: JobSnapshot): string {
  const positions = snapshot.job.questions
    .map((question) => question.position)
    .join(', ');
  return `OUTPUT NOTES
- Return one proposal string and one answer for each screening-question position.
- Return position values, never question text.
- Required answer positions: [${positions}].
- When there are no questions, return answers as an empty array.
- Do not include markdown fences, commentary, a score, or fields outside the requested schema.`;
}
