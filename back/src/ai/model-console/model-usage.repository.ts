import { Inject, Injectable } from '@nestjs/common';
import { desc } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import {
  jobAnalyses,
  profileAnalyses,
  proposalDrafts,
} from '../../database/schema';
import type { AnalysisUsage } from '../../profile/analysis/profile-analysis.schema';
import type { ModelSelectableCapability } from '../capabilities';

@Injectable()
export class ModelUsageRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  listRecent(
    capability: ModelSelectableCapability,
  ): Promise<Array<{ usage: AnalysisUsage }>> {
    switch (capability) {
      case 'profileAnalyzer':
        return this.db
          .select({ usage: profileAnalyses.usage })
          .from(profileAnalyses)
          .orderBy(desc(profileAnalyses.createdAt))
          .limit(20);
      case 'jobMatchEvaluator':
        return this.db
          .select({ usage: jobAnalyses.usage })
          .from(jobAnalyses)
          .orderBy(desc(jobAnalyses.createdAt))
          .limit(20);
      case 'proposalWriter':
        return this.db
          .select({ usage: proposalDrafts.usage })
          .from(proposalDrafts)
          .orderBy(desc(proposalDrafts.updatedAt))
          .limit(20);
    }
  }
}
