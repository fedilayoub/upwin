import type {
  ProfileCompleteness,
  ProfileSnapshot,
} from '@/features/upwork/profile/schema';

export function profileCaptureChips(snapshot: ProfileSnapshot): string[] {
  const { profile } = snapshot;
  const chips: string[] = [];

  if (profile.title) chips.push('Title');
  if (profile.overview) chips.push('Overview');
  pushCount(chips, profile.skills.length, 'skill');
  pushCount(chips, profile.portfolio.length, 'portfolio item');
  pushCount(chips, profile.employment.length, 'role');
  pushCount(chips, profile.certifications.length, 'certification');
  pushCount(chips, profile.languages.length, 'language');

  return chips;
}

export function profileCompletenessChips(
  completeness: ProfileCompleteness,
): string[] {
  const chips: string[] = [];

  if (completeness.hasProfilePhoto === true) chips.push('Photo');
  if (completeness.hasIntroVideo === true) chips.push('Intro video');
  if (completeness.idVerified === true) chips.push('ID verified');
  if (completeness.verifications) {
    pushCount(chips, completeness.verifications.length, 'verification');
  }
  if (completeness.linkedAccounts) {
    pushCount(chips, completeness.linkedAccounts.length, 'linked account');
  }

  return chips;
}

function pushCount(
  chips: string[],
  count: number,
  singularLabel: string,
): void {
  if (count === 0) return;
  chips.push(`${count} ${singularLabel}${count === 1 ? '' : 's'}`);
}
