import {
  Controller,
  Get,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { createZodValidationPipe } from 'nestjs-zod';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../database/schema';
import {
  activityQuerySchema,
  FunnelQueryDto,
  ScoreHistoryQueryDto,
  type ActivityQuery,
  type InsightsActivityResponse,
  type InsightsFunnelResponse,
  type InsightsScoreHistoryResponse,
  type InsightsSummaryResponse,
} from './insights.schema';
import { InsightsService } from './insights.service';

const TimeZoneValidationPipe = createZodValidationPipe({
  createValidationException: () =>
    new UnprocessableEntityException({
      code: 'INVALID_TIME_ZONE',
      message: 'The time zone is invalid.',
    }),
});
const timeZoneValidationPipe = new TimeZoneValidationPipe(activityQuerySchema);

@ApiTags('insights')
@ApiBearerAuth()
@Controller('insights')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Summarize profile, proposal, and outcome activity' })
  @ApiOkResponse({ description: 'The authenticated user insights summary.' })
  summary(@CurrentUser() user: User): Promise<InsightsSummaryResponse> {
    return this.insights.summary(user.id);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get the proposal activity heatmap' })
  @ApiQuery({ name: 'timeZone', required: false, example: 'Europe/Paris' })
  @ApiOkResponse({ description: 'Sparse daily proposal activity.' })
  activity(
    @CurrentUser() user: User,
    @Query(timeZoneValidationPipe) query: ActivityQuery,
  ): Promise<InsightsActivityResponse> {
    return this.insights.activity(user.id, query);
  }

  @Get('score-history')
  @ApiOperation({ summary: 'Get bounded Winning Score history' })
  @ApiOkResponse({ description: 'Chronological profile score history.' })
  scoreHistory(
    @CurrentUser() user: User,
    @Query() query: ScoreHistoryQueryDto,
  ): Promise<InsightsScoreHistoryResponse> {
    return this.insights.scoreHistory(user.id, query);
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Get the job-to-hire conversion funnel' })
  @ApiOkResponse({ description: 'Distinct job counts at each funnel step.' })
  funnel(
    @CurrentUser() user: User,
    @Query() query: FunnelQueryDto,
  ): Promise<InsightsFunnelResponse> {
    return this.insights.funnel(user.id, query);
  }
}
