import type { ProfileSnapshotRow } from '../database/schema';
import {
  legacyProfileSnapshotSchema,
  type ProfileSnapshot,
} from './profile-snapshot.schema';

/**
 * Rebuilds a `ProfileSnapshot` from its stored row.
 *
 * Rows written before a schema field existed still have to parse, so the
 * legacy-tolerant schema is used rather than the strict capture schema. An
 * absent text field is `undefined`, never `''` or `null`.
 */
export function profileSnapshotFromRow(
  row: ProfileSnapshotRow,
): ProfileSnapshot {
  return legacyProfileSnapshotSchema.parse({
    source: row.source,
    capturedAt: row.capturedAt.toISOString(),
    completeness: row.completeness,
    profile: {
      ...(row.name === null ? {} : { name: row.name }),
      ...(row.title === null ? {} : { title: row.title }),
      ...(row.overview === null ? {} : { overview: row.overview }),
      ...(row.hourlyRate === null ? {} : { hourlyRate: row.hourlyRate }),
      skills: row.skills,
      portfolio: row.portfolio,
      employment: row.employment,
      education: row.education,
      certifications: row.certifications,
      languages: row.languages,
    },
  });
}
