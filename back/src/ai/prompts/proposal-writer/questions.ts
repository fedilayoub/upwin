import type { JobSnapshot } from '../../../job-snapshots/job-snapshot.schema';
import { serializePromptData } from '../profile-analyzer/prompt-data';

export function renderScreeningQuestions(snapshot: JobSnapshot): string {
  return `SCREENING QUESTIONS
The question wording and positions are immutable data. Do not repeat question text in the output.
<screening_questions>
${serializePromptData(snapshot.job.questions)}
</screening_questions>`;
}
