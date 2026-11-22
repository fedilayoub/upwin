import {
  jobMatchRubricV1,
  type JobMatchAiCriterion,
} from '../../../jobs/analysis/rubric/job-match-v1';
import { JOB_MATCH_DIMENSION_IDS } from '../../../jobs/job-match-dimension';

export function renderJobMatchOutputNotes(): string {
  const expected = JOB_MATCH_DIMENSION_IDS.flatMap((dimensionId) => {
    const names = jobMatchRubricV1[dimensionId].criteria
      .filter(
        (criterion): criterion is JobMatchAiCriterion =>
          criterion.source === 'ai',
      )
      .map((criterion) => criterion.id);
    return names.length === 0 ? [] : [`- ${dimensionId}: ${names.join(', ')}`];
  }).join('\n');

  return `OUTPUT NOTES
- Write summary, strengths, concerns, criterion reasoning, and evidence to the freelancer in the second person: "you", "your", "you have".
- Never refer to the freelancer as "the freelancer", "the candidate", "the applicant", "they", or by name. The client stays in the third person.
- Return one dimension entry for each dimension listed below, and no deterministic-only budget dimension.
- Return only the listed AI criteria, once each.
- Criterion score values must be whole numbers from 0 through 100 selected with the supplied anchors.
- Evidence must identify supplied facts. State a supplied absence when it affects a judgment.
- Do not return a dimension score, match score, weights, deterministic score, proposal, or recommendation.
EXPECTED AI CRITERIA
${expected}`;
}
