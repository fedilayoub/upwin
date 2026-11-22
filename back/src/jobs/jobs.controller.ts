import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../database/schema';
import {
  JobMatchService,
  type JobMatchListResponse,
  type JobMatchResponse,
} from './analysis/job-match.service';
import {
  ProposalWriterService,
  type ProposalDraftResponse,
} from './drafts/proposal-writer.service';
import { ListJobAnalysesQueryDto } from './job-analysis.schema';

@ApiTags('proposal studio')
@ApiBearerAuth()
@Controller()
export class JobsController {
  constructor(
    private readonly matches: JobMatchService,
    private readonly drafts: ProposalWriterService,
  ) {}

  @Post('job-analyses')
  @ApiOperation({ summary: 'Evaluate and persist a job match' })
  @ApiCreatedResponse({ description: 'The backend-computed job match.' })
  createAnalysis(
    @CurrentUser() user: User,
    @Body() input: unknown,
  ): Promise<JobMatchResponse> {
    return this.matches.create(user.id, input);
  }

  @Get('job-analyses')
  @ApiOperation({ summary: 'List owned job analyses' })
  @ApiOkResponse({ description: 'Job analyses, newest first.' })
  listAnalyses(
    @CurrentUser() user: User,
    @Query() query: ListJobAnalysesQueryDto,
  ): Promise<JobMatchListResponse> {
    return this.matches.list(user.id, query);
  }

  @Get('job-analyses/:id')
  @ApiOperation({ summary: 'Get one owned job analysis' })
  @ApiOkResponse({ description: 'The requested job analysis.' })
  getAnalysis(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) analysisId: string,
  ): Promise<JobMatchResponse> {
    return this.matches.get(user.id, analysisId);
  }

  @Post('job-analyses/:id/draft')
  @ApiOperation({ summary: 'Generate a proposal and screening answers' })
  @ApiCreatedResponse({ description: 'The persisted proposal draft.' })
  createDraft(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) analysisId: string,
    @Body() input: unknown,
  ): Promise<ProposalDraftResponse> {
    return this.drafts.create(user.id, analysisId, input);
  }

  @Post('job-analyses/:id/draft/refine')
  @ApiOperation({ summary: 'Refine one proposal-draft block' })
  @ApiCreatedResponse({ description: 'The draft with one block replaced.' })
  refineDraft(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) analysisId: string,
    @Body() input: unknown,
  ): Promise<ProposalDraftResponse> {
    return this.drafts.refine(user.id, analysisId, input);
  }

  @Patch('proposal-drafts/:id')
  @ApiOperation({ summary: 'Mark one proposal-draft block copied or dismissed' })
  @ApiOkResponse({ description: 'The updated proposal draft.' })
  updateDraft(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) draftId: string,
    @Body() input: unknown,
  ): Promise<ProposalDraftResponse> {
    return this.drafts.updateStatus(user.id, draftId, input);
  }
}
