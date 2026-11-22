import { POLICY_INVARIANTS } from './analyzer-invariants';

export function renderAnalyzerPolicy(policy: string): string {
  return `ANALYZER POLICY
${policy}
${POLICY_INVARIANTS.map((invariant) => `- ${invariant}`).join('\n')}`;
}
