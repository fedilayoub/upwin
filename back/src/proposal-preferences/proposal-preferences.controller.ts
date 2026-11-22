import {
  Body,
  Controller,
  Get,
  Put,
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
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../database/schema';
import {
  type ProposalPreferences,
  putProposalPreferencesSchema,
  PutProposalPreferencesDto,
} from './proposal-preferences.schema';
import {
  type ProposalPreferencesResponse,
  ProposalPreferencesService,
} from './proposal-preferences.service';

const ProposalPreferencesValidationPipe = createZodValidationPipe({
  createValidationException: () =>
    new UnprocessableEntityException({
      message: 'The proposal preferences are invalid.',
    }),
});
const proposalPreferencesValidationPipe =
  new ProposalPreferencesValidationPipe(putProposalPreferencesSchema);

@ApiTags('proposal preferences')
@ApiBearerAuth()
@Controller('proposal-preferences')
export class ProposalPreferencesController {
  constructor(private readonly preferences: ProposalPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get proposal generation preferences' })
  @ApiOkResponse({ description: 'Saved preferences or backend defaults.' })
  get(@CurrentUser() user: User): Promise<ProposalPreferencesResponse> {
    return this.preferences.get(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Replace proposal generation preferences' })
  @ApiBody({ type: PutProposalPreferencesDto })
  @ApiOkResponse({ description: 'The saved proposal preferences.' })
  put(
    @CurrentUser() user: User,
    @Body(proposalPreferencesValidationPipe) input: ProposalPreferences,
  ): Promise<ProposalPreferencesResponse> {
    return this.preferences.put(user.id, input);
  }
}
