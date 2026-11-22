import type {
  AiRubricCriterion,
  ProfileSectionRubric,
} from '../../../profile/analysis/rubric/upwork-profile-v1';
import {
  profileRubricV1,
  RUBRIC_ANCHOR_SCORES,
} from '../../../profile/analysis/rubric/upwork-profile-v1';
import { PROFILE_SECTION_IDS } from '../../../profile/profile-section';
import type { AnalyzerTemplateContent } from '../prompt-template.schema';

export function renderRubricPrompt(
  rubric: Record<string, ProfileSectionRubric> = profileRubricV1,
  anchors: AnalyzerTemplateContent['criterionAnchors'],
): string {
  const sections = PROFILE_SECTION_IDS.map((sectionId) => {
    const section = rubric[sectionId];
    if (!section) throw new Error(`Rubric is missing section ${sectionId}.`);

    const criteria = section.criteria
      .filter(
        (criterion): criterion is AiRubricCriterion =>
          criterion.source === 'ai',
      )
      .map((criterion) => renderCriterion(criterion, anchors))
      .join('\n');

    return `SECTION ${sectionId} — ${section.label}\n${criteria}`;
  });

  return `UPWORK PROFILE RUBRIC\n${sections.join('\n\n')}`;
}

function renderCriterion(
  criterion: AiRubricCriterion,
  criterionAnchors: AnalyzerTemplateContent['criterionAnchors'],
): string {
  const configuredAnchors = criterionAnchors[criterion.id];
  if (!configuredAnchors) {
    throw new Error(`Template is missing criterion ${criterion.id}.`);
  }
  const anchors = RUBRIC_ANCHOR_SCORES.map(
    (score) => `  ${score}: ${configuredAnchors[score]}`,
  ).join('\n');

  return `CRITERION ${criterion.id} — ${criterion.label}\n${anchors}`;
}
