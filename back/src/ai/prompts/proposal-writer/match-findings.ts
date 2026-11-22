import { serializePromptData } from '../profile-analyzer/prompt-data';
import type { ProposalMatchFindings } from './prompt-data';

export function renderMatchFindings(findings: ProposalMatchFindings): string {
  return `MATCH FINDINGS
Use these backend-computed findings to select truthful emphasis. Do not mention scores in the draft unless the client explicitly asks for them.
<match_findings>
${serializePromptData(findings)}
</match_findings>`;
}
