import type { ProfileSnapshot } from '../../../profile-snapshots/profile-snapshot.schema';

export function renderImproverProfileSnapshot(
  snapshot: ProfileSnapshot,
): string {
  return [
    '<profile_snapshot>',
    JSON.stringify(snapshot),
    '</profile_snapshot>',
  ].join('\n');
}

