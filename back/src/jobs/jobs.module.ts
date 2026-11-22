import { Module } from '@nestjs/common';
import { FreelancerContextModule } from '../freelancer-context/freelancer-context.module';
import { GoalsModule } from '../goals/goals.module';
import { JobSnapshotsModule } from '../job-snapshots/job-snapshots.module';
import { ProfileSnapshotsModule } from '../profile-snapshots/profile-snapshots.module';
import { ProposalPreferencesModule } from '../proposal-preferences/proposal-preferences.module';
import { JobAnalysesRepository } from './analysis/job-analyses.repository';
import { JobMatchService } from './analysis/job-match.service';
import { ProposalDraftsRepository } from './drafts/proposal-drafts.repository';
import { ProposalWriterService } from './drafts/proposal-writer.service';
import { JobsController } from './jobs.controller';
import { ProposalOutcomesController } from './outcomes/proposal-outcomes.controller';
import { ProposalOutcomesRepository } from './outcomes/proposal-outcomes.repository';
import { ProposalOutcomesService } from './outcomes/proposal-outcomes.service';

@Module({
  imports: [
    GoalsModule,
    FreelancerContextModule,
    JobSnapshotsModule,
    ProfileSnapshotsModule,
    ProposalPreferencesModule,
    ],
  controllers: [JobsController, ProposalOutcomesController],
  providers: [
    JobAnalysesRepository,
    JobMatchService,
    ProposalDraftsRepository,
    ProposalWriterService,
    ProposalOutcomesRepository,
    ProposalOutcomesService,
  ],
  exports: [JobMatchService, ProposalWriterService],
})
export class JobsModule {}
