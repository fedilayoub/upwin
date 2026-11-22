export const JOB_MATCH_DIMENSION_IDS = [
  'skills',
  'domain',
  'experience',
  'budget',
  'goalAlignment',
] as const;

export type JobMatchDimensionId =
  (typeof JOB_MATCH_DIMENSION_IDS)[number];
