import type { JobCaptureResult, JobSkill, JobSnapshot } from '@/types/job';
import type { RawJob } from './payload';
import { parseJobSnapshot } from './schema';

export interface RawJobDomSkill {
  name?: string;
  relevanceLabel?: string;
}

export interface RawJobDom {
  title?: string;
  description?: string;
  questions: string[];
  skills: RawJobDomSkill[];
  workload?: string;
  durationLabel?: string;
  experienceLevel?: string;
  projectType?: string;
  client: {
    country?: string;
    paymentVerified: boolean | null;
    rating?: string;
    reviewCount?: string;
    totalSpend?: string;
    hires?: string;
    jobsPosted?: string;
    avgHourlyRatePaid?: string;
    industry?: string;
    companySize?: string;
  };
}

interface MapJobInput {
  payload?: RawJob;
  dom: RawJobDom;
  ciphertext: string;
  url: string;
  capturedAt: string;
}

export function mapExtractedJob({
  payload,
  dom,
  ciphertext,
  url,
  capturedAt,
}: MapJobInput): JobCaptureResult {
  const budgetType = resolveBudgetType(payload);
  const engagement = {
    budgetType,
    fixedBudget: resolveFixedBudget(payload, budgetType),
    hourlyBudget: resolveHourlyBudget(payload, budgetType),
    workload: normalizeOptionalText(payload?.workload ?? dom.workload),
    durationLabel: normalizeOptionalText(
      payload?.durationLabel ?? dom.durationLabel,
    ),
    experienceLevel:
      resolveContractorTier(payload?.contractorTier) ??
      resolveExperienceLabel(dom.experienceLevel),
    projectType: normalizeProjectType(payload?.projectType ?? dom.projectType),
  } satisfies JobSnapshot['job']['engagement'];

  const payloadQuestions = payload?.questions?.flatMap((question, index) => {
    const text = normalizeOptionalText(question.question);
    if (!text) return [];
    const position =
      question.position !== undefined &&
      Number.isInteger(question.position) &&
      question.position >= 0
        ? question.position
        : index;
    return [{ position, question: text }];
  });

  const domQuestions = dom.questions.flatMap((question, position) => {
    const text = normalizeOptionalText(question);
    return text ? [{ position, question: text }] : [];
  });

  const client = payload?.client;
  const jobsPosted =
    client?.jobsPosted ?? parseJobsPosted(dom.client.jobsPosted);
  const jobsWithHires = client?.jobsWithHires;
  const computedHireRate =
    jobsWithHires !== undefined && jobsPosted !== undefined && jobsPosted > 0
      ? Math.min(100, Math.max(0, (jobsWithHires / jobsPosted) * 100))
      : undefined;

  return parseJobSnapshot({
    source: payload ? 'upwork-payload' : 'upwork-dom',
    capturedAt,
    job: {
      // The allowlisted tab URL is the authority for resource identity. A page
      // payload may fill content, but it cannot redirect a capture to another id.
      ciphertext,
      url,
      title: normalizeOptionalText(payload?.title ?? dom.title),
      description: normalizeOptionalText(
        payload?.description ?? dom.description,
      ),
      postedAt: normalizeIsoDate(payload?.postedAt),
      category: normalizeOptionalText(payload?.category),
      categoryGroup: normalizeOptionalText(payload?.categoryGroup),
      engagement,
      skills: mapSkills(payload, dom),
      questions: payloadQuestions ?? domQuestions,
      client: {
        country: normalizeOptionalText(client?.country ?? dom.client.country),
        paymentVerified:
          client?.paymentVerified ?? dom.client.paymentVerified ?? null,
        rating: client?.rating ?? parseDecimal(dom.client.rating),
        reviewCount: client?.reviewCount ?? parseCount(dom.client.reviewCount),
        totalSpend: client?.totalSpend ?? parseMoney(dom.client.totalSpend),
        hires: client?.hires ?? parseHires(dom.client.hires),
        jobsPosted,
        hireRate: computedHireRate ?? parseHireRate(dom.client.jobsPosted),
        avgHourlyRatePaid:
          client?.avgHourlyRatePaid ?? parseMoney(dom.client.avgHourlyRatePaid),
        industry: normalizeOptionalText(
          client?.industry ?? dom.client.industry,
        ),
        companySize: normalizeOptionalText(
          client?.companySize ?? dom.client.companySize,
        ),
      },
      activity: {
        applicants: payload?.activity.applicants,
        interviewing: payload?.activity.interviewing,
        hired: payload?.activity.hired,
        lastClientActivityAt: normalizeIsoDate(
          payload?.activity.lastClientActivityAt,
        ),
      },
    },
  });
}

function mapSkills(payload: RawJob | undefined, dom: RawJobDom): JobSkill[] {
  const rawSkills =
    payload?.skills?.map((skill) => ({
      name: skill.name,
      relevance: skill.relevance,
    })) ??
    dom.skills.map((skill) => ({
      name: skill.name,
      relevance: skill.relevanceLabel,
    }));
  const seen = new Set<string>();

  return rawSkills.flatMap((skill) => {
    const name = normalizeOptionalText(skill.name);
    if (!name) return [];

    const key = name.toLocaleLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);

    return [{ name, relevance: resolveSkillRelevance(skill.relevance) }];
  });
}

function resolveBudgetType(
  payload: RawJob | undefined,
): JobSnapshot['job']['engagement']['budgetType'] {
  if (payload?.hourlyBudgetType !== undefined) return 'hourly';
  if (
    payload?.fixedBudgetAmount !== undefined &&
    payload.fixedBudgetAmount > 0
  ) {
    return 'fixed';
  }
  return 'unknown';
}

function resolveHourlyBudget(
  payload: RawJob | undefined,
  budgetType: JobSnapshot['job']['engagement']['budgetType'],
): JobSnapshot['job']['engagement']['hourlyBudget'] {
  if (
    !payload ||
    budgetType !== 'hourly' ||
    payload.hourlyBudgetType === 'NOT_PROVIDED' ||
    !payload.budgetCurrency
  ) {
    return undefined;
  }

  const min = payload.hourlyBudgetMin ?? undefined;
  const max = payload.hourlyBudgetMax ?? undefined;
  if (min === undefined && max === undefined) return undefined;

  return { min, max, currency: payload.budgetCurrency };
}

function resolveFixedBudget(
  payload: RawJob | undefined,
  budgetType: JobSnapshot['job']['engagement']['budgetType'],
): JobSnapshot['job']['engagement']['fixedBudget'] {
  if (
    !payload ||
    budgetType !== 'fixed' ||
    payload.fixedBudgetAmount === undefined ||
    !payload.budgetCurrency
  ) {
    return undefined;
  }

  return {
    amount: payload.fixedBudgetAmount,
    currency: payload.budgetCurrency,
  };
}

function resolveContractorTier(
  tier: number | undefined,
): JobSnapshot['job']['engagement']['experienceLevel'] {
  if (tier === 1) return 'entry';
  if (tier === 2) return 'intermediate';
  if (tier === 3) return 'expert';
  return undefined;
}

function resolveExperienceLabel(
  value: string | undefined,
): JobSnapshot['job']['engagement']['experienceLevel'] {
  const normalized = normalizeOptionalText(value)?.toLocaleLowerCase();
  if (normalized === 'entry level' || normalized === 'entry') return 'entry';
  if (normalized === 'intermediate') return 'intermediate';
  if (normalized === 'expert') return 'expert';
  return undefined;
}

function resolveSkillRelevance(
  value: string | undefined,
): JobSkill['relevance'] {
  const normalized = normalizeOptionalText(value)
    ?.toLocaleLowerCase()
    .replaceAll('_', ' ');
  if (normalized === 'mandatory' || normalized === 'mandatory skills') {
    return 'mandatory';
  }
  if (
    normalized === 'nice to have' ||
    normalized === 'nice-to-have skills' ||
    normalized === 'nice to have skills'
  ) {
    return 'nice-to-have';
  }
  return 'unknown';
}

function normalizeProjectType(value: string | undefined): string | undefined {
  return (
    normalizeOptionalText(value)?.replace(/^Project Type:\s*/iu, '') ||
    undefined
  );
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/gu, ' ').trim();
  return normalized || undefined;
}

function normalizeIsoDate(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return undefined;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function parseDecimal(value: string | undefined): number | undefined {
  const match = normalizeOptionalText(value)?.match(/\d+(?:\.\d+)?/u);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCount(value: string | undefined): number | undefined {
  const match = normalizeOptionalText(value)?.match(/\d[\d,]*/u);
  if (!match) return undefined;
  const parsed = Number(match[0].replaceAll(',', ''));
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function parseMoney(value: string | undefined): number | undefined {
  const match = normalizeOptionalText(value)?.match(/([\d,.]+)\s*([kmb])?/iu);
  if (!match?.[1]) return undefined;

  const amount = Number(match[1].replaceAll(',', ''));
  if (!Number.isFinite(amount)) return undefined;
  const suffix = match[2]?.toLocaleLowerCase();
  const multiplier =
    suffix === 'k'
      ? 1_000
      : suffix === 'm'
        ? 1_000_000
        : suffix === 'b'
          ? 1_000_000_000
          : 1;
  return amount * multiplier;
}

function parseHires(value: string | undefined): number | undefined {
  return parseLabeledNumber(value, /([\d,]+)\s+hires?/iu);
}

function parseJobsPosted(value: string | undefined): number | undefined {
  return parseLabeledNumber(value, /([\d,]+)\s+jobs?\s+posted/iu);
}

function parseHireRate(value: string | undefined): number | undefined {
  const match = normalizeOptionalText(value)?.match(
    /(\d+(?:\.\d+)?)%\s+hire\s+rate/iu,
  );
  if (!match?.[1]) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseLabeledNumber(
  value: string | undefined,
  pattern: RegExp,
): number | undefined {
  const match = normalizeOptionalText(value)?.match(pattern);
  if (!match?.[1]) return undefined;
  const parsed = Number(match[1].replaceAll(',', ''));
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
