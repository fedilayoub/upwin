export interface RawJobQuestion {
  position?: number;
  question?: string;
}

export interface RawJobSkill {
  name?: string;
  relevance?: string;
}

export interface RawJob {
  title?: string;
  description?: string;
  ciphertext?: string;
  questions?: RawJobQuestion[];
  hourlyBudgetType?: string;
  hourlyBudgetMin?: number | null;
  hourlyBudgetMax?: number | null;
  fixedBudgetAmount?: number;
  budgetCurrency?: string;
  workload?: string;
  durationLabel?: string;
  contractorTier?: number;
  projectType?: string;
  postedAt?: string;
  category?: string;
  categoryGroup?: string;
  skills?: RawJobSkill[];
  client: {
    country?: string;
    paymentVerified?: boolean;
    rating?: number;
    reviewCount?: number;
    totalSpend?: number;
    hires?: number;
    jobsPosted?: number;
    jobsWithHires?: number;
    avgHourlyRatePaid?: number;
    industry?: string;
    companySize?: string;
  };
  activity: {
    applicants?: number;
    interviewing?: number;
    hired?: number;
    lastClientActivityAt?: string;
  };
}

const MAX_RESOLVE_DEPTH = 80;
const REACTIVE_TAGS = new Set(['ShallowReactive', 'Reactive', 'Ref']);

export function resolveNuxtPayload(json: string): unknown {
  let root: unknown;

  try {
    root = JSON.parse(json);
  } catch {
    return undefined;
  }

  if (!Array.isArray(root)) return undefined;

  const cache = new Map<number, unknown>();
  const resolving = new Set<number>();

  const resolveReference = (index: number, depth: number): unknown => {
    if (depth > MAX_RESOLVE_DEPTH || index < 0 || index >= root.length) {
      return undefined;
    }
    if (cache.has(index)) return cache.get(index);
    if (resolving.has(index)) return undefined;

    const entry: unknown = root[index];
    if (entry === null || typeof entry !== 'object') return entry;

    resolving.add(index);

    if (Array.isArray(entry)) {
      const [tag, valueIndex] = entry;
      if (
        typeof tag === 'string' &&
        REACTIVE_TAGS.has(tag) &&
        typeof valueIndex === 'number'
      ) {
        const value = resolveReference(valueIndex, depth + 1);
        cache.set(index, value);
        resolving.delete(index);
        return value;
      }

      const values: unknown[] = [];
      cache.set(index, values);
      for (const value of entry) {
        values.push(
          typeof value === 'number'
            ? resolveReference(value, depth + 1)
            : value,
        );
      }
      resolving.delete(index);
      return values;
    }

    const record: Record<string, unknown> = {};
    cache.set(index, record);
    for (const [key, value] of Object.entries(entry)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      record[key] =
        typeof value === 'number' ? resolveReference(value, depth + 1) : value;
    }
    resolving.delete(index);
    return record;
  };

  return resolveReference(0, 0);
}

export function readJobFromPayload(payload: unknown): RawJob | undefined {
  const payloadRecord = asRecord(payload);
  const vuex = asRecord(payloadRecord?.vuex);
  const details = asRecord(vuex?.jobDetails);
  const job = asRecord(details?.job);
  const buyer = asRecord(details?.buyer);
  const sands = asRecord(details?.sands);

  if (!job || !buyer || !sands) return undefined;

  const extendedBudget = asRecord(job.extendedBudgetInfo);
  const fixedBudget = asRecord(job.budget);
  const engagementDuration = asRecord(job.engagementDuration);
  const category = asRecord(job.category);
  const categoryGroup = asRecord(job.categoryGroup);
  const activity = asRecord(job.clientActivity);
  const location = asRecord(buyer.location);
  const stats = asRecord(buyer.stats);
  const jobs = asRecord(buyer.jobs);
  const company = asRecord(buyer.company);
  const companyProfile = asRecord(company?.profile);
  const totalCharges = asRecord(stats?.totalCharges);
  const avgHourlyRate = asRecord(buyer.avgHourlyJobsRate);

  return {
    title: readString(job.title),
    description: readString(job.description),
    ciphertext: readString(job.ciphertext),
    questions: readArray(job.questions)?.flatMap((value) => {
      const question = asRecord(value);
      return question
        ? [
            {
              position: readNumber(question.position),
              question: readString(question.question),
            },
          ]
        : [];
    }),
    hourlyBudgetType: readString(extendedBudget?.hourlyBudgetType),
    hourlyBudgetMin: readNullableNumber(extendedBudget?.hourlyBudgetMin),
    hourlyBudgetMax: readNullableNumber(extendedBudget?.hourlyBudgetMax),
    fixedBudgetAmount: readNumber(fixedBudget?.amount),
    budgetCurrency: readString(fixedBudget?.currencyCode),
    workload: readString(job.workload),
    durationLabel: readString(engagementDuration?.label),
    contractorTier: readNumber(job.contractorTier),
    projectType: readArray(job.segmentationData)
      ?.flatMap((value) => {
        const label = readString(asRecord(value)?.label);
        return label === undefined ? [] : [label];
      })
      .at(0),
    postedAt: readString(job.publishTime),
    category: readString(category?.name),
    categoryGroup: readString(categoryGroup?.name),
    skills: readPayloadSkills(sands),
    client: {
      country: readString(location?.country),
      paymentVerified: readBoolean(buyer.isPaymentMethodVerified),
      rating: readNumber(stats?.score),
      reviewCount: readNumber(stats?.feedbackCount),
      totalSpend: readNumber(totalCharges?.amount),
      hires: readNumber(stats?.totalAssignments),
      jobsPosted: readNumber(jobs?.postedCount),
      jobsWithHires: readNumber(stats?.totalJobsWithHires),
      avgHourlyRatePaid: readNumber(avgHourlyRate?.amount),
      industry: readString(companyProfile?.industry),
      companySize: readString(companyProfile?.size),
    },
    activity: {
      applicants: readNumber(activity?.totalApplicants),
      interviewing: readNumber(activity?.totalInvitedToInterview),
      hired: readNumber(activity?.totalHired),
      lastClientActivityAt: readString(activity?.lastBuyerActivity),
    },
  };
}

function readPayloadSkills(
  sands: Record<string, unknown>,
): RawJobSkill[] | undefined {
  const ontologySkills = readArray(sands.ontologySkills);
  const additionalSkills = readArray(sands.additionalSkills);
  if (!ontologySkills && !additionalSkills) return undefined;

  const nested = (ontologySkills ?? []).flatMap((group) => {
    const children = readArray(asRecord(group)?.children) ?? [];
    return children.flatMap(readSkill);
  });

  return [...nested, ...(additionalSkills ?? []).flatMap(readSkill)];
}

function readSkill(value: unknown): RawJobSkill[] {
  const skill = asRecord(value);
  return skill
    ? [
        {
          name: readString(skill.name),
          relevance: readString(skill.relevance),
        },
      ]
    : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readNullableNumber(value: unknown): number | null | undefined {
  return value === null ? null : readNumber(value);
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
