import {
  JOB_MATCH_ANCHOR_SCORES,
  jobMatchRubricV1,
  type JobMatchAiCriterion,
} from '../../../jobs/analysis/rubric/job-match-v1';
import { JOB_MATCH_DIMENSION_IDS } from '../../../jobs/job-match-dimension';

export function renderJobMatchRubric(): string {
  const dimensions = JOB_MATCH_DIMENSION_IDS.flatMap((dimensionId) => {
    const criteria: JobMatchAiCriterion[] = jobMatchRubricV1[
      dimensionId
    ].criteria.flatMap((criterion) =>
      criterion.source === 'ai' ? [criterion] : [],
    );
    if (criteria.length === 0) return [];

    return [
      `DIMENSION ${dimensionId} — ${jobMatchRubricV1[dimensionId].label}\n${criteria
        .map(renderCriterion)
        .join('\n')}`,
    ];
  });

  return `JOB MATCH RUBRIC\n${dimensions.join('\n\n')}`;
}

function renderCriterion(criterion: JobMatchAiCriterion): string {
  const anchors = JOB_MATCH_ANCHOR_SCORES.map(
    (score) => `  ${score}: ${criterion.anchors[score]}`,
  ).join('\n');
  return `CRITERION ${criterion.id} — ${criterion.label}\n${anchors}`;
}
