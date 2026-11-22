import { forwardRef, Module } from '@nestjs/common';
import { FreelancerContextModule } from '../../freelancer-context/freelancer-context.module';
import { GoalsModule } from '../../goals/goals.module';
import { ProfileAnalysisModule } from '../../profile/analysis/profile-analysis.module';
import { ProfileSnapshotsModule } from '../../profile-snapshots/profile-snapshots.module';
import { PromptConsoleController } from './prompt-console.controller';
import { PromptConsoleService } from './prompt-console.service';
import { PromptRevisionsRepository } from './prompt-revisions.repository';
import { PromptTemplatesService } from './prompt-templates.service';

@Module({
  imports: [
    GoalsModule,
    FreelancerContextModule,
    ProfileSnapshotsModule,
    forwardRef(() => ProfileAnalysisModule),
  ],
  controllers: [PromptConsoleController],
  providers: [
    PromptRevisionsRepository,
    PromptTemplatesService,
    PromptConsoleService,
  ],
  exports: [PromptTemplatesService],
})
export class PromptConsoleModule {}
