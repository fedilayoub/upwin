import type { JobMatchDimensionId } from '@/types/job';

export const DIMENSION_LABELS: Readonly<
  Record<JobMatchDimensionId, string>
> = {
  skills: 'Skills',
  domain: 'Domain',
  experience: 'Experience',
  budget: 'Budget fit',
  goalAlignment: 'Goal alignment',
};
