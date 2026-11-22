import type { Translate } from '@/features/i18n/i18n-context';
import type {
  GoalObjective,
  ProfileRecommendation,
  ProfileSectionId,
} from '@/types/profile';

export function profileSectionLabels(
  t: Translate,
): Record<ProfileSectionId, string> {
  return {
    experience: t('profile.section.experience'),
    goalAlignment: t('profile.section.goalAlignment'),
    overview: t('profile.section.overview'),
    portfolio: t('profile.section.portfolio'),
    positioning: t('profile.section.positioning'),
    skills: t('profile.section.skills'),
    title: t('profile.section.title'),
    trust: t('profile.section.trust'),
  };
}

export function profileGoalLabel(
  goal: GoalObjective,
  t: Translate,
): string {
  const keys = {
    'first-client': 'settings.goal.first-client',
    'higher-paying-projects': 'settings.goal.higher-paying-projects',
    'more-clients': 'settings.goal.more-clients',
    'more-responses': 'settings.goal.more-responses',
    scale: 'settings.goal.scale',
  } as const;
  return t(keys[goal]);
}

export function profileImpactLabel(
  impact: ProfileRecommendation['impact'],
  t: Translate,
): string {
  const levels = {
    high: t('profile.impact.high'),
    low: t('profile.impact.low'),
    medium: t('profile.impact.medium'),
  };
  return t('profile.impact', { level: levels[impact] });
}
