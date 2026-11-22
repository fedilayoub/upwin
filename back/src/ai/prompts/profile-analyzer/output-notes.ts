import type { AiRubricCriterion } from '../../../profile/analysis/rubric/upwork-profile-v1';
import { profileRubricV1 } from '../../../profile/analysis/rubric/upwork-profile-v1';
import { PROFILE_SECTION_IDS } from '../../../profile/profile-section';

export function renderOutputNotes(previousPriorityCount = 0): string {
  const expectedCriteria = PROFILE_SECTION_IDS.map((sectionId) => {
    const names = profileRubricV1[sectionId].criteria
      .filter(
        (criterion): criterion is AiRubricCriterion =>
          criterion.source === 'ai',
      )
      .map((criterion) => criterion.id)
      .join(', ');
    return `- ${sectionId}: ${names}`;
  }).join('\n');

  const previousPriorityNotes =
    previousPriorityCount === 0
      ? ''
      : `
- Return one previousPriorityReviews entry for each of the ${previousPriorityCount} listed previous priorities, using its ref number.
- status is implemented when the current profile clearly reflects the advice, partial when it was addressed only in part, and not-implemented when the profile is unchanged in that respect.
- Judge only what the supplied snapshot shows. Absence of evidence is not-implemented, never implemented.
- note is one short sentence addressed to the freelancer, citing what the profile now shows.`;

  return `OUTPUT NOTES
- Return one section entry for each listed section and only the listed AI criteria.
- Criterion score values must be whole numbers from 0 through 100, selected using the supplied anchors.
- Do not return a section total, section score, Winning Score, weights, or deterministic scores.
- Criterion evidence must quote or closely identify supplied data; identify a supplied absence explicitly when it affects the criterion.
- Every priority must cite at least one evidence item and must quote or closely identify the supplied data it is about.
- Priorities must identify concrete changes, not promises of hiring. Do not assign impact; the backend derives it from the goal weight and score gap.${previousPriorityNotes}
EXPECTED AI CRITERIA
${expectedCriteria}`;
}
