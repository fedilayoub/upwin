import {
  analyzerTemplateContentSchema,
  type AnalyzerTemplateContent,
} from '../prompt-template.schema';
import { PROFILE_SECTION_IDS } from '../../../profile/profile-section';
import { profileRubricV1 } from '../../../profile/analysis/rubric/upwork-profile-v1';

const criterionAnchors: AnalyzerTemplateContent['criterionAnchors'] = {};

for (const sectionId of PROFILE_SECTION_IDS) {
  for (const criterion of profileRubricV1[sectionId].criteria) {
    if (criterion.source === 'ai') {
      criterionAnchors[criterion.id] = {
        0: criterion.anchors[0],
        25: criterion.anchors[25],
        50: criterion.anchors[50],
        75: criterion.anchors[75],
        100: criterion.anchors[100],
      };
    }
  }
}

export const DEFAULT_ANALYZER_TEMPLATE: AnalyzerTemplateContent =
  analyzerTemplateContentSchema.parse({
    systemPersona: 'You are the Upwork Pilot profile evaluator.',
    policy: `- Base every judgment only on supplied evidence; never invent experience or results.
- Distinguish missing information from poor information.
- Use the criterion-specific anchors exactly; interpolate only between adjacent anchors.
- Evaluate consistency with the target work and the user's stated objective.
- Prioritize improvements by expected impact.`,
    goalStrategies: {
      'first-client':
        'Emphasize clarity, approachable credibility, relevant proof, and reducing the risk perceived by a first client.',
      'more-clients':
        'Emphasize repeatable client value, breadth within a coherent specialty, proof, and a clear reason to engage.',
      'more-responses':
        'Emphasize immediate relevance, searchable positioning, a strong opening, and unmistakable target-job alignment.',
      'higher-paying-projects':
        'Emphasize specialization, authority, case-study proof, quantified results, and credible premium positioning.',
      scale:
        'Emphasize repeatable high-value delivery, authority, mature proof, and positioning that supports larger engagements.',
    },
    criterionAnchors,
  });
