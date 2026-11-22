import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { User } from '../../database/schema';
import { ListProfileAnalysesQueryDto } from './profile-analysis.schema';
import {
  type ProfileAnalysisListResponse,
  type ProfileAnalysisProgressResponse,
  type ProfileAnalysisResponse,
  ProfileAnalysesService,
} from './profile-analyses.service';

@ApiTags('profile analyses')
@ApiBearerAuth()
@Controller('profile-analyses')
export class ProfileAnalysesController {
  constructor(private readonly analyses: ProfileAnalysesService) {}

  @Post()
  @ApiOperation({ summary: 'Analyze and persist a profile snapshot' })
  @ApiCreatedResponse({ description: 'The backend-computed profile analysis.' })
  create(
    @CurrentUser() user: User,
    @Body() input: unknown,
  ): Promise<ProfileAnalysisResponse> {
    return this.analyses.create(user.id, input);
  }

  @Get()
  @ApiOperation({ summary: 'List analyses owned by the authenticated user' })
  @ApiOkResponse({ description: 'Analyses, newest first.' })
  list(
    @CurrentUser() user: User,
    @Query() query: ListProfileAnalysesQueryDto,
  ): Promise<ProfileAnalysisListResponse> {
    return this.analyses.list(user.id, query);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Summarize progress from persisted analyses' })
  @ApiOkResponse({ description: 'Score trend and first-to-latest deltas.' })
  progress(
    @CurrentUser() user: User,
  ): Promise<ProfileAnalysisProgressResponse> {
    return this.analyses.progress(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one owned profile analysis' })
  @ApiOkResponse({ description: 'The requested profile analysis.' })
  get(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) analysisId: string,
  ): Promise<ProfileAnalysisResponse> {
    return this.analyses.get(user.id, analysisId);
  }
}
