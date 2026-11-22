import type { FreelancerContextFields } from '../../../freelancer-context/freelancer-context.schema';
import type { GoalResponse } from '../../../goals/goals.service';
import type { TargetJobProfile } from '../../../profile/analysis/deterministic/profile-facts';
import type { RankedMissingPortfolioProject } from '../../../profile/recommendations/portfolio-gap';
import type { ProfileSnapshot } from '../../../profile-snapshots/profile-snapshot.schema';
import type { ProfileSectionId } from '../../../profile/profile-section';
import type { ProfileSuggestionStyle } from '../../../profile/suggestions/profile-suggestion.schema';
import type { ProfileSuggestionTarget } from '../../../profile/suggestions/suggestion-target';

export interface ProfileImproverPromptData {
  goal: GoalResponse;
  context: FreelancerContextFields;
  targetJobProfile: TargetJobProfile;
  snapshot: ProfileSnapshot;
  section: ProfileSectionId;
  style: ProfileSuggestionStyle | null;
  target: ProfileSuggestionTarget;
  originalValue: string | null;
  rankedMissingPortfolioProjects: RankedMissingPortfolioProject[];
}
