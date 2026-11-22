import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AiModule } from './ai/ai.module';
import { ModelConsoleModule } from './ai/model-console/model-console.module';
import { PromptConsoleModule } from './ai/prompt-console/prompt-console.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.schema';
import { DatabaseModule } from './database/database.module';
import { FreelancerContextModule } from './freelancer-context/freelancer-context.module';
import { GoalsModule } from './goals/goals.module';
import { HealthModule } from './health/health.module';
import { InsightsModule } from './insights/insights.module';
import { JobSnapshotsModule } from './job-snapshots/job-snapshots.module';
import { JobsModule } from './jobs/jobs.module';
import { ProfileAnalysisModule } from './profile/analysis/profile-analysis.module';
import { ProfileSnapshotsModule } from './profile-snapshots/profile-snapshots.module';
import { ProposalPreferencesModule } from './proposal-preferences/proposal-preferences.module';
import { UsersModule } from './users/users.module';
import { VideosModule } from './videos/videos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    AiModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    HealthModule,
    GoalsModule,
    FreelancerContextModule,
    InsightsModule,
    JobSnapshotsModule,
    JobsModule,
    ProposalPreferencesModule,
    VideosModule,
    ProfileSnapshotsModule,
    ProfileAnalysisModule,
    PromptConsoleModule,
    ModelConsoleModule,
  ],
  providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
