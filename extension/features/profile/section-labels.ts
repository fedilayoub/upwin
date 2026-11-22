import type { GoalObjective, ProfileSectionId } from '@/types/profile';

export const SECTION_LABELS: Record<ProfileSectionId, string> = {
  positioning: 'Positioning',
  overview: 'Overview',
  title: 'Title',
  skills: 'Skills',
  portfolio: 'Portfolio',
  experience: 'Experience',
  trust: 'Trust',
  goalAlignment: 'Goal Alignment',
};

export const GOAL_LABELS: Record<GoalObjective, string> = {
  'first-client': 'Get my first client',
  'more-clients': 'Win more clients',
  'more-responses': 'Increase proposal response rate',
  'higher-paying-projects': 'Get higher-paying projects',
  scale: 'Scale my freelancing business',
};

export const SUGGESTION_FIELD_LABELS = {
  title: 'Title',
  overview: 'Overview',
  skills: 'Skills',
  portfolio: 'Portfolio',
  employment: 'Employment history',
} as const;

export const GOAL_ALIGNMENT_EXPLAINER =
  'How clearly your profile supports the work you configured.';

export const EVIDENCE_LABEL = 'Evidence from your profile';
