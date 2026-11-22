import type { JobCaptureResult, JobSnapshot } from '@/types/job';
import { z } from 'zod';
import { isSupportedJobUrl } from './url';

export const JOB_SNAPSHOT_CAPS = {
  description: 20_000,
  question: 2_000,
  questions: 20,
  skills: 50,
  title: 500,
} as const;

const nonEmptyTextSchema = z.string().trim().min(1);
const optionalTextSchema = nonEmptyTextSchema.optional();
const utcDateTimeSchema = z.iso
  .datetime()
  .refine((value) => value.endsWith('Z'), 'Date must be UTC');

const jobSkillSchema = z
  .object({
    name: nonEmptyTextSchema,
    relevance: z.enum(['mandatory', 'nice-to-have', 'unknown']),
  })
  .strict();

const jobQuestionSchema = z
  .object({
    position: z.number().int().nonnegative(),
    question: nonEmptyTextSchema,
  })
  .strict();

const moneySchema = z
  .object({
    amount: z.number().finite().nonnegative(),
    currency: nonEmptyTextSchema,
  })
  .strict();

const hourlyBudgetSchema = z
  .object({
    min: z.number().finite().nonnegative().optional(),
    max: z.number().finite().nonnegative().optional(),
    currency: nonEmptyTextSchema,
  })
  .strict();

const uncappedJobSnapshotSchema = z
  .object({
    source: z.enum(['upwork-payload', 'upwork-dom', 'manual']),
    capturedAt: utcDateTimeSchema,
    job: z
      .object({
        ciphertext: nonEmptyTextSchema.regex(/^~0[0-9a-f]+$/i),
        url: z
          .url()
          .refine(isSupportedJobUrl, 'URL is not a supported Upwork job URL'),
        title: nonEmptyTextSchema,
        description: nonEmptyTextSchema,
        postedAt: utcDateTimeSchema.optional(),
        category: optionalTextSchema,
        categoryGroup: optionalTextSchema,
        engagement: z
          .object({
            budgetType: z.enum(['hourly', 'fixed', 'unknown']),
            fixedBudget: moneySchema.optional(),
            hourlyBudget: hourlyBudgetSchema.optional(),
            workload: optionalTextSchema,
            durationLabel: optionalTextSchema,
            experienceLevel: z
              .enum(['entry', 'intermediate', 'expert'])
              .optional(),
            projectType: optionalTextSchema,
          })
          .strict(),
        skills: z.array(jobSkillSchema),
        questions: z.array(jobQuestionSchema),
        client: z
          .object({
            country: optionalTextSchema,
            paymentVerified: z.boolean().nullable(),
            rating: z.number().finite().min(0).max(5).optional(),
            reviewCount: z.number().int().nonnegative().optional(),
            totalSpend: z.number().finite().nonnegative().optional(),
            hires: z.number().int().nonnegative().optional(),
            jobsPosted: z.number().int().nonnegative().optional(),
            hireRate: z.number().finite().min(0).max(100).optional(),
            avgHourlyRatePaid: z.number().finite().nonnegative().optional(),
            industry: optionalTextSchema,
            companySize: optionalTextSchema,
          })
          .strict(),
        activity: z
          .object({
            applicants: z.number().int().nonnegative().optional(),
            interviewing: z.number().int().nonnegative().optional(),
            hired: z.number().int().nonnegative().optional(),
            lastClientActivityAt: utcDateTimeSchema.optional(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export const jobSnapshotSchema = uncappedJobSnapshotSchema.transform(
  (snapshot): JobSnapshot => truncateJobSnapshot(snapshot).snapshot,
);

export const jobCaptureResultSchema = z
  .object({
    snapshot: jobSnapshotSchema,
    truncatedFields: z.array(nonEmptyTextSchema),
  })
  .strict();

export class JobSnapshotValidationError extends Error {
  constructor() {
    super('We could not read this job. Please try again.');
    this.name = 'JobSnapshotValidationError';
  }
}

export function parseJobSnapshot(input: unknown): JobCaptureResult {
  const parsed = uncappedJobSnapshotSchema.safeParse(input);
  if (!parsed.success) throw new JobSnapshotValidationError();

  return truncateJobSnapshot(parsed.data);
}

export function isJobCaptureResult(value: unknown): value is JobCaptureResult {
  return jobCaptureResultSchema.safeParse(value).success;
}

function truncateJobSnapshot(
  snapshot: z.output<typeof uncappedJobSnapshotSchema>,
): JobCaptureResult {
  const truncatedFields: string[] = [];

  const capText = (value: string, maximum: number, field: string): string => {
    if (value.length <= maximum) return value;
    truncatedFields.push(field);
    return value.slice(0, maximum);
  };

  const cappedQuestions = snapshot.job.questions.map((question, index) => ({
    ...question,
    question: capText(
      question.question,
      JOB_SNAPSHOT_CAPS.question,
      `job.questions[${index}].question`,
    ),
  }));

  if (snapshot.job.skills.length > JOB_SNAPSHOT_CAPS.skills) {
    truncatedFields.push('job.skills');
  }
  if (cappedQuestions.length > JOB_SNAPSHOT_CAPS.questions) {
    truncatedFields.push('job.questions');
  }

  return {
    snapshot: {
      ...snapshot,
      job: {
        ...snapshot.job,
        title: capText(
          snapshot.job.title,
          JOB_SNAPSHOT_CAPS.title,
          'job.title',
        ),
        description: capText(
          snapshot.job.description,
          JOB_SNAPSHOT_CAPS.description,
          'job.description',
        ),
        skills: snapshot.job.skills.slice(0, JOB_SNAPSHOT_CAPS.skills),
        questions: cappedQuestions.slice(0, JOB_SNAPSHOT_CAPS.questions),
      },
    },
    truncatedFields,
  };
}
