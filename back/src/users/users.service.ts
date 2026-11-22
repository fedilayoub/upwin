import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { LOCAL_USER_ID, users, type User } from '../database/schema';

@Injectable()
export class UsersService {
  private localUser: Promise<User> | null = null;

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * The single local user, created on first use. Concurrent first requests
   * share one in-flight upsert; a failed one is retried on the next request.
   */
  ensureLocalUser(): Promise<User> {
    this.localUser ??= this.upsertLocalUser().catch((error: unknown) => {
      this.localUser = null;
      throw error;
    });

    return this.localUser;
  }

  private async upsertLocalUser(): Promise<User> {
    await this.db
      .insert(users)
      .values({ id: LOCAL_USER_ID })
      .onConflictDoNothing();

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, LOCAL_USER_ID))
      .limit(1);

    if (!user) {
      throw new Error('The local user row is missing after its upsert.');
    }

    return user;
  }
}
