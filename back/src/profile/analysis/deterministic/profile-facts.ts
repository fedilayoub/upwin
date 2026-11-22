import type { GoalResponse } from '../../../goals/goals.service';
import type {
  ProfileCompleteness,
  ProfileSnapshot,
} from '../../../profile-snapshots/profile-snapshot.schema';

export interface TargetJobProfile {
  role: string;
  projectTypes: string[];
  clients: string[];
  preferredSkills: string[];
}

export interface ProfileFacts {
  presence: {
    title: boolean;
    overview: boolean;
    skills: boolean;
    portfolio: boolean;
    employment: boolean;
    education: boolean;
    certifications: boolean;
    languages: boolean;
  };
  counts: {
    skills: number;
    portfolio: number;
    employment: number;
    education: number;
    certifications: number;
    languages: number;
  };
  approximateTextLengths: {
    title: number;
    overview: number;
    portfolio: number;
    employment: number;
    total: number;
  };
  duplicates: {
    skills: string[];
    portfolioTitles: string[];
  };
  targetKeywords: {
    all: string[];
    present: string[];
    missing: string[];
    coverage: number;
  };
  completeness: ProfileCompleteness & {
    avgResponseTimeIsSlow: boolean | null;
  };
  emptyProfile: boolean;
}

const STOP_WORDS = new Set([
  'and',
  'for',
  'from',
  'the',
  'with',
  'your',
  'you',
  'that',
  'this',
  'into',
  'our',
]);

export function targetJobProfileFromGoal(goal: GoalResponse): TargetJobProfile {
  return {
    role: goal.targetRole,
    projectTypes: goal.targetProjectTypes,
    clients: goal.targetClients,
    preferredSkills: goal.preferredSkills,
  };
}

export function inspectProfile(
  snapshot: ProfileSnapshot,
  targetJobProfile: TargetJobProfile,
): ProfileFacts {
  const { profile } = snapshot;
  const presence = {
    title: profile.title !== undefined,
    overview: profile.overview !== undefined,
    skills: profile.skills.length > 0,
    portfolio: profile.portfolio.length > 0,
    employment: profile.employment.length > 0,
    education: profile.education.length > 0,
    certifications: profile.certifications.length > 0,
    languages: profile.languages.length > 0,
  };
  const counts = {
    skills: profile.skills.length,
    portfolio: profile.portfolio.length,
    employment: profile.employment.length,
    education: profile.education.length,
    certifications: profile.certifications.length,
    languages: profile.languages.length,
  };
  const titleLength = profile.title?.length ?? 0;
  const overviewLength = profile.overview?.length ?? 0;
  const portfolioLength = profile.portfolio.reduce(
    (total, item) =>
      total + textLength(item.title, item.description, ...item.skills),
    0,
  );
  const employmentLength = profile.employment.reduce(
    (total, item) =>
      total +
      textLength(item.title, item.company, item.period, item.description),
    0,
  );
  const approximateTextLengths = {
    title: titleLength,
    overview: overviewLength,
    portfolio: portfolioLength,
    employment: employmentLength,
    total: titleLength + overviewLength + portfolioLength + employmentLength,
  };
  const allTargetKeywords = extractTargetKeywords(targetJobProfile);
  const normalizedProfileText = normalize(
    [
      profile.title,
      profile.overview,
      ...profile.skills,
      ...profile.portfolio.flatMap((item) => [
        item.title,
        item.description,
        ...item.skills,
      ]),
      ...profile.employment.flatMap((item) => [
        item.title,
        item.company,
        item.description,
      ]),
      ...profile.education.flatMap((item) => [item.school, item.degree]),
      ...profile.certifications.flatMap((item) => [item.name, item.issuer]),
    ]
      .filter((value): value is string => value !== undefined)
      .join(' '),
  );
  const present = allTargetKeywords.filter((keyword) =>
    containsToken(normalizedProfileText, keyword),
  );
  const missing = allTargetKeywords.filter(
    (keyword) => !present.includes(keyword),
  );

  return {
    presence,
    counts,
    approximateTextLengths,
    duplicates: {
      skills: duplicateValues(profile.skills),
      portfolioTitles: duplicateValues(
        profile.portfolio
          .map((item) => item.title)
          .filter((title): title is string => title !== undefined),
      ),
    },
    targetKeywords: {
      all: allTargetKeywords,
      present,
      missing,
      coverage:
        allTargetKeywords.length === 0
          ? 0
          : Math.round((present.length / allTargetKeywords.length) * 100),
    },
    completeness: {
      ...snapshot.completeness,
      avgResponseTimeIsSlow: classifyAverageResponseTime(
        snapshot.completeness.avgResponseTime,
      ),
    },
    emptyProfile: !Object.values(presence).some(Boolean),
  };
}

export function classifyAverageResponseTime(
  value: string | null | undefined,
): boolean | null {
  if (value === null || value === undefined) return null;

  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
  if (
    /\b(?:within|under|less than) (?:an?|one|a few|few) hours?\b/u.test(
      normalized,
    ) ||
    /\bwithin an hour\b/u.test(normalized)
  ) {
    return false;
  }

  const range = normalized.match(
    /\b(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(hours?|days?)\b/u,
  );
  if (range) {
    const lower = Number(range[1]);
    const unit = range[3];
    if (!Number.isFinite(lower)) return null;
    return unit?.startsWith('day') === true ? lower >= 1 : lower >= 12;
  }

  const lowerBound = normalized.match(
    /\b(?:more than|over)\s+(\d+(?:\.\d+)?)\s*(hours?|days?)\b/u,
  );
  if (lowerBound) {
    const amount = Number(lowerBound[1]);
    const unit = lowerBound[2];
    if (!Number.isFinite(amount)) return null;
    return unit?.startsWith('day') === true ? amount >= 1 : amount >= 4;
  }

  if (/\b(?:a|one|1) day\b/u.test(normalized)) return true;

  const exact = normalized.match(/\b(\d+(?:\.\d+)?)\+?\s*(hours?|days?)\b/u);
  if (!exact) return null;
  if (/\b(?:within|under|less than|up to)\b/u.test(normalized)) return false;

  const amount = Number(exact[1]);
  const unit = exact[2];
  if (!Number.isFinite(amount)) return null;
  return unit?.startsWith('day') === true ? amount >= 1 : amount >= 12;
}

function textLength(...values: Array<string | undefined>): number {
  return values.reduce<number>(
    (total, value) => total + (value?.length ?? 0),
    0,
  );
}

function duplicateValues(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = normalize(value);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

export function extractTargetKeywords(target: TargetJobProfile): string[] {
  const source = [
    target.role,
    ...target.projectTypes,
    ...target.clients,
    ...target.preferredSkills,
  ];
  const keywords = new Set<string>();

  for (const value of source) {
    for (const token of normalize(value).split(/[^a-z0-9+#.]+/u)) {
      if (token.length < 2 || STOP_WORDS.has(token)) continue;
      keywords.add(token);
    }
  }

  return [...keywords].sort();
}

export function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

export function containsToken(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`(^|[^a-z0-9+#.])${escaped}($|[^a-z0-9+#.])`, 'u').test(
    haystack,
  );
}
