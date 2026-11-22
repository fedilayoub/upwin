import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { profileSnapshots } from '../database/schema';
import { profileSnapshotFromRow } from './profile-snapshot-row';
import {
  diffProfileSnapshots,
  type ProfileSnapshotChanges,
} from './profile-snapshot.diff';
import {
  parseProfileSnapshot,
  ProfileSnapshotValidationError,
  type ProfileSnapshot,
} from './profile-snapshot.schema';

export interface CreateProfileSnapshotResponse {
  id: string;
  capturedAt: string;
  createdAt: string;
  truncatedFields: string[];
}

export interface ProfileSnapshotDiffResponse {
  fromSnapshotId: string;
  toSnapshotId: string;
  fromCapturedAt: string;
  toCapturedAt: string;
  changes: ProfileSnapshotChanges;
}

@Injectable()
export class ProfileSnapshotsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(
    authenticatedUserId: string,
    input: unknown,
  ): Promise<CreateProfileSnapshotResponse> {
    let parsed;

    try {
      parsed = parseProfileSnapshot(input);
    } catch (error: unknown) {
      if (error instanceof ProfileSnapshotValidationError) {
        throw new UnprocessableEntityException({
          code: 'SNAPSHOT_INVALID',
          message: error.message,
        });
      }

      throw error;
    }

    const { snapshot, truncatedFields } = parsed;
    const [created] = await this.db
      .insert(profileSnapshots)
      .values({
        userId: authenticatedUserId,
        source: snapshot.source,
        completeness: snapshot.completeness,
        name: snapshot.profile.name,
        title: snapshot.profile.title,
        overview: snapshot.profile.overview,
        hourlyRate: snapshot.profile.hourlyRate,
        skills: snapshot.profile.skills,
        portfolio: snapshot.profile.portfolio,
        employment: snapshot.profile.employment,
        education: snapshot.profile.education,
        certifications: snapshot.profile.certifications,
        languages: snapshot.profile.languages,
        capturedAt: new Date(snapshot.capturedAt),
      })
      .returning({
        id: profileSnapshots.id,
        capturedAt: profileSnapshots.capturedAt,
        createdAt: profileSnapshots.createdAt,
      });

    if (!created) throw new Error('Profile snapshot insert returned no row.');

    return {
      id: created.id,
      capturedAt: created.capturedAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      truncatedFields,
    };
  }

  async diff(
    authenticatedUserId: string,
  ): Promise<ProfileSnapshotDiffResponse | null> {
    const snapshots = await this.db
      .select()
      .from(profileSnapshots)
      .where(eq(profileSnapshots.userId, authenticatedUserId))
      .orderBy(desc(profileSnapshots.capturedAt), desc(profileSnapshots.id))
      .limit(2);
    const current = snapshots[0];
    const previous = snapshots[1];
    if (!current || !previous) return null;

    return {
      fromSnapshotId: previous.id,
      toSnapshotId: current.id,
      fromCapturedAt: previous.capturedAt.toISOString(),
      toCapturedAt: current.capturedAt.toISOString(),
      changes: diffProfileSnapshots(
        profileSnapshotFromRow(previous),
        profileSnapshotFromRow(current),
      ),
    };
  }

  async findLatestSkills(authenticatedUserId: string): Promise<string[]> {
    const [snapshot] = await this.db
      .select({ skills: profileSnapshots.skills })
      .from(profileSnapshots)
      .where(eq(profileSnapshots.userId, authenticatedUserId))
      .orderBy(desc(profileSnapshots.capturedAt), desc(profileSnapshots.id))
      .limit(1);

    return snapshot?.skills ?? [];
  }

  async findLatest(
    authenticatedUserId: string,
  ): Promise<ProfileSnapshot | null> {
    const [snapshot] = await this.db
      .select()
      .from(profileSnapshots)
      .where(eq(profileSnapshots.userId, authenticatedUserId))
      .orderBy(desc(profileSnapshots.capturedAt), desc(profileSnapshots.id))
      .limit(1);

    return snapshot ? profileSnapshotFromRow(snapshot) : null;
  }
}
