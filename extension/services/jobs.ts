import { sendExtensionRequest } from '@/features/extension/client';
import {
  createCaptureJobRequest,
  createJobPageStatusRequest,
  isJobCaptureResult,
  isJobPageStatus,
} from '@/features/extension/protocol';
import { jobSnapshotSchema } from '@/features/upwork/job/schema';
import {
  JOB_MATCH_DIMENSION_IDS,
  type JobAnalysis,
  type JobCaptureResult,
  type JobPageStatus,
  type JobSnapshot,
  type JobSnapshotReceipt,
} from '@/types/job';
import { z } from 'zod';
import { apiClient, type TokenProvider } from './api';

const criterionSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    evidence: z.array(z.string().trim().min(1)),
  })
  .strict();

const dimensionSchema = z
  .object({
    id: z.enum(JOB_MATCH_DIMENSION_IDS),
    score: z.number().int().min(0).max(100),
    criteria: z.array(criterionSchema),
  })
  .strict();

const dimensionsSchema = z
  .array(dimensionSchema)
  .length(JOB_MATCH_DIMENSION_IDS.length)
  .superRefine((dimensions, context) => {
    const ids = new Set(dimensions.map(({ id }) => id));
    if (ids.size !== JOB_MATCH_DIMENSION_IDS.length) {
      context.addIssue({
        code: 'custom',
        message: 'Job dimensions must contain every dimension exactly once.',
      });
    }
    if (
      dimensions.some(
        (dimension, index) => dimension.id !== JOB_MATCH_DIMENSION_IDS[index],
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Job dimensions are not in contract order.',
      });
    }
  });

const versionsSchema = z
  .object({
    prompt: z.string().trim().min(1),
    rubric: z.string().trim().min(1),
    scoring: z.string().trim().min(1),
    requestedModel: z.string().trim().min(1),
    gateway: z.string().trim().min(1).optional(),
    provider: z.string().trim().min(1),
    model: z.string().trim().min(1),
  })
  .strict();

const jobAnalysisSchema = z
  .object({
    id: z.uuid(),
    jobSnapshotId: z.uuid(),
    goalId: z.uuid(),
    matchScore: z.number().int().min(0).max(100),
    summary: z.string().trim().min(1),
    dimensions: dimensionsSchema,
    strengths: z.array(z.string().trim().min(1)),
    concerns: z.array(z.string().trim().min(1)),
    questionCount: z.number().int().nonnegative(),
    versions: versionsSchema,
    createdAt: z.iso.datetime(),
  })
  .strict();

const snapshotReceiptSchema = z
  .object({
    id: z.uuid(),
    ciphertext: z.string().trim().min(1),
    capturedAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
    truncatedFields: z.array(z.string().trim().min(1)),
  })
  .strict();

function parseResponse<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
  resource: string,
): z.output<TSchema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`The backend returned an invalid ${resource} response.`);
  }
  return parsed.data;
}

export const jobService = {
  capture(): Promise<JobCaptureResult> {
    return sendExtensionRequest(createCaptureJobRequest(), isJobCaptureResult);
  },

  /** Asks the launcher for the tab's URL only. Reads no DOM. */
  getPageStatus(): Promise<JobPageStatus> {
    return sendExtensionRequest(createJobPageStatusRequest(), isJobPageStatus);
  },

  async persist(
    snapshot: JobSnapshot,
    getToken: TokenProvider,
  ): Promise<JobSnapshotReceipt> {
    const parsedSnapshot = jobSnapshotSchema.safeParse(snapshot);
    if (!parsedSnapshot.success) {
      throw new Error('We could not read this job. Please try again.');
    }
    const response = await apiClient.request<unknown>('/job-snapshots', {
      body: JSON.stringify({ snapshot: parsedSnapshot.data }),
      getToken,
      method: 'POST',
      operation: 'POST /job-snapshots',
    });
    return parseResponse(snapshotReceiptSchema, response, 'job snapshot');
  },

  async analyze(
    snapshot: JobSnapshot,
    getToken: TokenProvider,
  ): Promise<JobAnalysis> {
    const parsedSnapshot = jobSnapshotSchema.safeParse(snapshot);
    if (!parsedSnapshot.success) {
      throw new Error('We could not read this job. Please try again.');
    }
    const response = await apiClient.request<unknown>('/job-analyses', {
      body: JSON.stringify({ snapshot: parsedSnapshot.data }),
      getToken,
      method: 'POST',
      operation: 'POST /job-analyses',
    });
    return parseResponse(jobAnalysisSchema, response, 'job analysis');
  },
};
