import type { ProfileFacts } from '../../../profile/analysis/deterministic/profile-facts';
import { serializePromptData } from './prompt-data';

export function renderDeterministicEvidence(facts: ProfileFacts): string {
  return `DETERMINISTIC EVIDENCE
These facts were computed by the backend. Use them as evidence; do not recalculate counts or keyword presence.
<deterministic_facts>
${serializePromptData(facts)}
</deterministic_facts>`;
}
