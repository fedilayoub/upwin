import { z } from 'zod';

export const PROFILE_SNAPSHOT_CAPS = {
  employment: 50,
  overview: 10_000,
  portfolio: 50,
  portfolioDescription: 5_000,
  skills: 100,
  title: 500,
} as const;

const nonEmptyTextSchema = z.string().trim().min(1);
const optionalTextSchema = nonEmptyTextSchema.optional();

export const UNREADABLE_PROFILE_COMPLETENESS = {
  hasIntroVideo: null,
  hasProfilePhoto: null,
  availabilityBadge: null,
  hoursPerWeek: null,
  avgResponseTime: null,
  idVerified: null,
  verifications: null,
  licenses: null,
  linkedAccounts: null,
} as const;

export const profileCompletenessSchema = z
  .object({
    hasIntroVideo: z.boolean().nullable(),
    hasProfilePhoto: z.boolean().nullable(),
    availabilityBadge: z.boolean().nullable(),
    // undefined means the anchored section was readable but held no value;
    // null means the section anchor itself could not be read.
    hoursPerWeek: optionalTextSchema.nullable(),
    avgResponseTime: optionalTextSchema.nullable(),
    idVerified: z.boolean().nullable(),
    verifications: z.array(nonEmptyTextSchema).nullable(),
    licenses: z.number().int().nonnegative().nullable(),
    linkedAccounts: z.array(nonEmptyTextSchema).nullable(),
  })
  .strict();

export const portfolioItemSchema = z
  .object({
    title: optionalTextSchema,
    description: optionalTextSchema,
    skills: z.array(nonEmptyTextSchema),
    url: optionalTextSchema,
  })
  .strict();

export const employmentSchema = z
  .object({
    title: optionalTextSchema,
    company: optionalTextSchema,
    period: optionalTextSchema,
    description: optionalTextSchema,
  })
  .strict();

export const educationSchema = z
  .object({
    school: optionalTextSchema,
    degree: optionalTextSchema,
    period: optionalTextSchema,
  })
  .strict();

export const certificationSchema = z
  .object({
    name: optionalTextSchema,
    issuer: optionalTextSchema,
    year: optionalTextSchema,
  })
  .strict();

export const languageSchema = z
  .object({
    name: nonEmptyTextSchema,
    proficiency: optionalTextSchema,
  })
  .strict();

const uncappedProfileSnapshotSchema = z
  .object({
    source: z.enum(['upwork', 'manual', 'api']),
    capturedAt: z.iso
      .datetime()
      .refine((value) => value.endsWith('Z'), 'capturedAt must be UTC'),
    // Required on every write. Omitting the block is client/server version
    // skew, not evidence that nine selectors were attempted and unreadable.
    completeness: profileCompletenessSchema,
    profile: z
      .object({
        name: optionalTextSchema,
        title: optionalTextSchema,
        overview: optionalTextSchema,
        hourlyRate: z.number().finite().nonnegative().optional(),
        skills: z.array(nonEmptyTextSchema),
        portfolio: z.array(portfolioItemSchema),
        employment: z.array(employmentSchema),
        education: z.array(educationSchema),
        certifications: z.array(certificationSchema),
        languages: z.array(languageSchema),
      })
      .strict(),
  })
  .strict();

export type ProfileSnapshot = z.output<typeof uncappedProfileSnapshotSchema>;
export type ProfileCompleteness = ProfileSnapshot['completeness'];
export type PortfolioItem = ProfileSnapshot['profile']['portfolio'][number];
export type Employment = ProfileSnapshot['profile']['employment'][number];
export type Education = ProfileSnapshot['profile']['education'][number];
export type Certification =
  ProfileSnapshot['profile']['certifications'][number];
export type Language = ProfileSnapshot['profile']['languages'][number];

export interface ParsedProfileSnapshot {
  snapshot: ProfileSnapshot;
  truncatedFields: string[];
}

export const profileSnapshotSchema = uncappedProfileSnapshotSchema.transform(
  (snapshot): ProfileSnapshot => truncateProfileSnapshot(snapshot).snapshot,
);

// Read compatibility only: rows captured before completeness shipped do not
// prove that the corresponding DOM anchors were inspected.
export const legacyProfileSnapshotSchema = uncappedProfileSnapshotSchema
  .omit({ completeness: true })
  .extend({
    completeness: profileCompletenessSchema.default(
      UNREADABLE_PROFILE_COMPLETENESS,
    ),
  })
  .transform(
    (snapshot): ProfileSnapshot => truncateProfileSnapshot(snapshot).snapshot,
  );

export class ProfileSnapshotValidationError extends Error {
  constructor() {
    super('The profile snapshot is invalid.');
    this.name = 'ProfileSnapshotValidationError';
  }
}

export function parseProfileSnapshot(input: unknown): ParsedProfileSnapshot {
  const parsed = uncappedProfileSnapshotSchema.safeParse(input);

  if (!parsed.success) throw new ProfileSnapshotValidationError();

  return truncateProfileSnapshot(parsed.data);
}

function truncateProfileSnapshot(
  snapshot: z.output<typeof uncappedProfileSnapshotSchema>,
): ParsedProfileSnapshot {
  const truncatedFields: string[] = [];

  const capText = (
    value: string | undefined,
    maximum: number,
    field: string,
  ): string | undefined => {
    if (value === undefined || value.length <= maximum) return value;

    truncatedFields.push(field);
    return value.slice(0, maximum);
  };

  const capArray = <T>(values: T[], maximum: number, field: string): T[] => {
    if (values.length > maximum) truncatedFields.push(field);
    return values.slice(0, maximum);
  };

  const portfolio = capArray(
    snapshot.profile.portfolio.map((item, index) => ({
      ...item,
      description: capText(
        item.description,
        PROFILE_SNAPSHOT_CAPS.portfolioDescription,
        `profile.portfolio[${index}].description`,
      ),
    })),
    PROFILE_SNAPSHOT_CAPS.portfolio,
    'profile.portfolio',
  );

  return {
    snapshot: {
      ...snapshot,
      profile: {
        ...snapshot.profile,
        title: capText(
          snapshot.profile.title,
          PROFILE_SNAPSHOT_CAPS.title,
          'profile.title',
        ),
        overview: capText(
          snapshot.profile.overview,
          PROFILE_SNAPSHOT_CAPS.overview,
          'profile.overview',
        ),
        skills: capArray(
          snapshot.profile.skills,
          PROFILE_SNAPSHOT_CAPS.skills,
          'profile.skills',
        ),
        portfolio,
        employment: capArray(
          snapshot.profile.employment,
          PROFILE_SNAPSHOT_CAPS.employment,
          'profile.employment',
        ),
      },
    },
    truncatedFields,
  };
}
