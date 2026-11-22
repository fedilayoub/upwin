export const PROFILE_SECTION_IDS = [
  'positioning',
  'overview',
  'title',
  'skills',
  'portfolio',
  'experience',
  'trust',
  'goalAlignment',
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTION_IDS)[number];
