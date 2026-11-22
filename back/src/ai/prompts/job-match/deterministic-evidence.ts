import type { JobFacts } from '../../../jobs/analysis/deterministic/job-facts';
import { serializePromptData } from '../profile-analyzer/prompt-data';

export function renderJobDeterministicEvidence(facts: JobFacts): string {
  return `DETERMINISTIC EVIDENCE
These facts were computed by the backend. Use them as evidence; do not recalculate or override them.
<deterministic_facts>
${serializePromptData(facts)}
</deterministic_facts>`;
}
