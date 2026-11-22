import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { jobSnapshots, type JobSnapshotRow } from '../database/schema';
import {
  JobSnapshotValidationError,
  jobSnapshotSchema,
  parseJobSnapshotRequest,
  type JobSnapshot,
} from './job-snapshot.schema';

export interface CreateJobSnapshotResponse {
  id: string;
  ciphertext: string;
  capturedAt: string;
  createdAt: string;
  truncatedFields: string[];
}

@Injectable()
export class JobSnapshotsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(
    authenticatedUserId: string,
    input: unknown,
  ): Promise<CreateJobSnapshotResponse> {
    let parsed;

    try {
      parsed = parseJobSnapshotRequest(input);
    } catch (error: unknown) {
      if (error instanceof JobSnapshotValidationError) {
        throw new UnprocessableEntityException({
          code: 'JOB_SNAPSHOT_INVALID',
          message: error.message,
        });
      }
      throw error;
    }

    const { snapshot, truncatedFields } = parsed;
    const [created] = await this.db
      .insert(jobSnapshots)
      .values({
        userId: authenticatedUserId,
        ciphertext: snapshot.job.ciphertext,
        url: snapshot.job.url,
        capturedAt: new Date(snapshot.capturedAt),
        source: snapshot.source,
        snapshot,
      })
      .returning({
        id: jobSnapshots.id,
        ciphertext: jobSnapshots.ciphertext,
        capturedAt: jobSnapshots.capturedAt,
        createdAt: jobSnapshots.createdAt,
      });

    if (!created) throw new Error('Job snapshot insert returned no row.');

    return {
      id: created.id,
      ciphertext: created.ciphertext,
      capturedAt: created.capturedAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      truncatedFields,
    };
  }

  async findOwned(
    authenticatedUserId: string,
    snapshotId: string,
  ): Promise<JobSnapshotRow> {
    const [snapshot] = await this.db
      .select()
      .from(jobSnapshots)
      .where(
        and(
          eq(jobSnapshots.id, snapshotId),
          eq(jobSnapshots.userId, authenticatedUserId),
        ),
      )
      .limit(1);

    if (!snapshot) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'The job snapshot was not found.',
      });
    }

    return snapshot;
  }

  async findOwnedMatching(
    authenticatedUserId: string,
    requestedSnapshot: JobSnapshot,
  ): Promise<JobSnapshotRow> {
    const candidates = await this.db
      .select()
      .from(jobSnapshots)
      .where(
        and(
          eq(jobSnapshots.userId, authenticatedUserId),
          eq(jobSnapshots.ciphertext, requestedSnapshot.job.ciphertext),
          eq(jobSnapshots.capturedAt, new Date(requestedSnapshot.capturedAt)),
        ),
      )
      .orderBy(desc(jobSnapshots.createdAt), desc(jobSnapshots.id));
    const snapshot = candidates.find((candidate) => {
      const parsed = jobSnapshotSchema.safeParse(candidate.snapshot);
      return parsed.success && isDeepStrictEqual(parsed.data, requestedSnapshot);
    });

    if (!snapshot) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'The persisted job snapshot was not found.',
      });
    }

    return snapshot;
  }
}
