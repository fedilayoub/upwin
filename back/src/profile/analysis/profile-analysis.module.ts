import { forwardRef, Module } from '@nestjs/common';
import { PromptConsoleModule } from '../../ai/prompt-console/prompt-console.module';
import { FreelancerContextModule } from '../../freelancer-context/freelancer-context.module';
import { GoalsModule } from '../../goals/goals.module';
import { ProfileAnalysesController } from './profile-analyses.controller';
import { ProfileAnalysesRepository } from './profile-analyses.repository';
import { ProfileAnalysesService } from './profile-analyses.service';
import { ProfileEvaluator } from './profile-evaluator.service';
import { ProfileImprover } from '../suggestions/profile-improver.service';
import { ProfileSuggestionsController } from '../suggestions/profile-suggestions.controller';
import { ProfileSuggestionsRepository } from '../suggestions/profile-suggestions.repository';
import { ProfileSuggestionsService } from '../suggestions/profile-suggestions.service';

@Module({
  imports: [
    GoalsModule,
    FreelancerContextModule,
    forwardRef(() => PromptConsoleModule),
  ],
  controllers: [ProfileAnalysesController, ProfileSuggestionsController],
  providers: [
    ProfileAnalysesRepository,
    ProfileAnalysesService,
    ProfileEvaluator,
    ProfileImprover,
    ProfileSuggestionsRepository,
    ProfileSuggestionsService,
  ],
  exports: [ProfileAnalysesService],
})
export class ProfileAnalysisModule {}
