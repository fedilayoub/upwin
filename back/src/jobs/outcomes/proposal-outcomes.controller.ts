import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { createZodValidationPipe } from 'nestjs-zod';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { User } from '../../database/schema';
import {
  listProposalOutcomesQuerySchema,
  proposalOutcomeStatsQuerySchema,
  putProposalOutcomeSchema,
  PutProposalOutcomeDto,
  type ListProposalOutcomesQuery,
  type ProposalOutcomeListResponse,
  type ProposalOutcomeResponse,
  type ProposalOutcomeStatsQuery,
  type ProposalOutcomeStatsResponse,
  type PutProposalOutcome,
} from './proposal-outcomes.schema';
import { ProposalOutcomesService } from './proposal-outcomes.service';

const OutcomeValidationPipe = createZodValidationPipe({
  createValidationException: () =>
    new UnprocessableEntityException({
      code: 'OUTCOME_INVALID',
      message: 'The proposal outcome is invalid.',
    }),
});
const outcomeValidationPipe = new OutcomeValidationPipe(
  putProposalOutcomeSchema,
);
const outcomeListValidationPipe = new OutcomeValidationPipe(
  listProposalOutcomesQuerySchema,
);
const outcomeStatsValidationPipe = new OutcomeValidationPipe(
  proposalOutcomeStatsQuerySchema,
);

@ApiTags('proposal outcomes')
@ApiBearerAuth()
@Controller()
export class ProposalOutcomesController {
  constructor(private readonly outcomes: ProposalOutcomesService) {}

  @Put('job-analyses/:id/outcome')
  @ApiOperation({ summary: 'Create or update a proposal outcome' })
  @ApiBody({ type: PutProposalOutcomeDto })
  @ApiOkResponse({ description: 'The current proposal outcome.' })
  put(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) jobAnalysisId: string,
    @Body(outcomeValidationPipe) input: PutProposalOutcome,
  ): Promise<ProposalOutcomeResponse> {
    return this.outcomes.put(user.id, jobAnalysisId, input);
  }

  @Get('proposal-outcomes')
  @ApiOperation({ summary: 'List proposal outcomes' })
  @ApiOkResponse({
    description: 'Proposal outcomes, newest created date first.',
  })
  list(
    @CurrentUser() user: User,
    @Query(outcomeListValidationPipe) query: ListProposalOutcomesQuery,
  ): Promise<ProposalOutcomeListResponse> {
    return this.outcomes.list(user.id, query);
  }

  @Get('proposal-outcomes/stats')
  @ApiOperation({ summary: 'Get application tracker status counts' })
  @ApiOkResponse({ description: 'Application tracker counts for the window.' })
  stats(
    @CurrentUser() user: User,
    @Query(outcomeStatsValidationPipe) query: ProposalOutcomeStatsQuery,
  ): Promise<ProposalOutcomeStatsResponse> {
    return this.outcomes.stats(user.id, query);
  }
}
