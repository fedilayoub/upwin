import type { ProfileCompleteness, ProfileSnapshot } from './schema';

export interface RawPortfolioItem {
  title?: string;
  description?: string;
  skills: string[];
}

export interface RawEmployment {
  title?: string;
  company?: string;
  period?: string;
  description?: string;
}

export interface RawEducation {
  school?: string;
  degree?: string;
  period?: string;
}

export interface RawCertification {
  name?: string;
  issuer?: string;
  year?: string;
}

export interface RawLanguage {
  name?: string;
  proficiency?: string;
}

export interface RawProfileCompleteness {
  hasIntroVideo: boolean | null;
  hasProfilePhoto: boolean | null;
  availabilityBadge: boolean | null;
  hoursPerWeek?: string | null;
  avgResponseTime?: string | null;
  idVerified: boolean | null;
  verifications: string[] | null;
  licenses: number | null;
  linkedAccounts: string[] | null;
}

export interface RawExtractedProfile {
  name?: string;
  title?: string;
  overview?: string;
  hourlyRate?: string;
  skills: string[];
  portfolio: RawPortfolioItem[];
  employment: RawEmployment[];
  education: RawEducation[];
  certifications: RawCertification[];
  languages: RawLanguage[];
  completeness: RawProfileCompleteness;
}

export type ParsedProfile = ProfileSnapshot['profile'];

export function parseExtractedProfile(raw: RawExtractedProfile): ParsedProfile {
  return {
    name: normalizeOptionalText(raw.name),
    title: normalizeOptionalText(raw.title),
    overview: normalizeMultilineText(raw.overview),
    hourlyRate: parseHourlyRate(raw.hourlyRate),
    skills: uniqueNonEmpty(raw.skills),
    portfolio: raw.portfolio
      .map((item) => ({
        title: normalizeOptionalText(item.title),
        description: normalizeMultilineText(item.description),
        skills: uniqueNonEmpty(item.skills),
      }))
      .filter(hasAnyValue),
    employment: raw.employment
      .map((item) => ({
        title: normalizeOptionalText(item.title),
        company: normalizeOptionalText(item.company),
        period: normalizeOptionalText(item.period),
        description: normalizeMultilineText(item.description),
      }))
      .filter(hasAnyValue),
    education: raw.education
      .map((item) => ({
        school: normalizeOptionalText(item.school),
        degree: normalizeOptionalText(item.degree),
        period: normalizeOptionalText(item.period),
      }))
      .filter(hasAnyValue),
    certifications: raw.certifications
      .map((item) => ({
        name: normalizeOptionalText(item.name),
        issuer: normalizeOptionalText(item.issuer),
        year: normalizeOptionalText(item.year),
      }))
      .filter(hasAnyValue),
    languages: raw.languages.flatMap((item) => {
      const name = normalizeLanguageName(item.name);
      if (!name) return [];

      return [
        {
          name,
          proficiency: normalizeOptionalText(item.proficiency),
        },
      ];
    }),
  };
}

export function parseExtractedCompleteness(
  raw: RawProfileCompleteness,
): ProfileCompleteness {
  return {
    hasIntroVideo: raw.hasIntroVideo,
    hasProfilePhoto: raw.hasProfilePhoto,
    availabilityBadge: raw.availabilityBadge,
    hoursPerWeek: normalizeNullableOptionalText(raw.hoursPerWeek),
    avgResponseTime: normalizeNullableOptionalText(raw.avgResponseTime),
    idVerified: raw.idVerified,
    verifications:
      raw.verifications === null ? null : uniqueNonEmpty(raw.verifications),
    licenses: raw.licenses,
    linkedAccounts:
      raw.linkedAccounts === null ? null : uniqueNonEmpty(raw.linkedAccounts),
  };
}

export function normalizeOptionalText(
  value: string | undefined,
): string | undefined {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized : undefined;
}

/**
 * Normalizes free-form prose while keeping its line structure. Upwork renders
 * the overview and descriptions with `white-space: pre-line`, so the user's
 * paragraphs and bullet lines are real newlines in the text. Collapsing them
 * to spaces flattened the profile into one paragraph, and the rewrite came
 * back flat too, so a copied suggestion had to be reformatted by hand.
 *
 * Spaces inside a line still collapse, each line is trimmed, and runs of
 * blank lines shrink to a single paragraph break.
 */
export function normalizeMultilineText(
  value: string | undefined,
): string | undefined {
  const normalized = value
    ?.replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized ? normalized : undefined;
}

function normalizeNullableOptionalText(
  value: string | null | undefined,
): string | null | undefined {
  return value === null ? null : normalizeOptionalText(value);
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map(normalizeOptionalText).filter(isDefined))];
}

function normalizeLanguageName(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalText(value)?.replace(/:\s*$/u, '').trim();
  return normalized || undefined;
}

function parseHourlyRate(value: string | undefined): number | undefined {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return undefined;

  const match = normalized.match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) return undefined;

  const hourlyRate = Number(match[0].replaceAll(',', ''));
  return Number.isFinite(hourlyRate) ? hourlyRate : undefined;
}

function hasAnyValue(value: object): boolean {
  return Object.values(value).some((entry) =>
    Array.isArray(entry) ? entry.length > 0 : entry !== undefined,
  );
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
