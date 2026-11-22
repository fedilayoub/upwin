import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { createZodValidationPipe } from 'nestjs-zod';
import type { AiCapability } from '../capabilities';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { User } from '../../database/schema';
import {
  CreatePromptRevisionDto,
  promptCapabilitySchema,
  UpdatePromptRevisionDto,
} from './prompt-console.schema';
import { PromptConsoleService } from './prompt-console.service';

const CapabilityValidationPipe = createZodValidationPipe({
  createValidationException: () =>
    new UnprocessableEntityException({
      code: 'PROMPT_CAPABILITY_INVALID',
      message: 'Prompt capability is invalid.',
    }),
});
const capabilityValidationPipe = new CapabilityValidationPipe(
  promptCapabilitySchema,
);

@ApiTags('admin-prompts')
@ApiBearerAuth()
@Controller('admin/prompts')
export class PromptConsoleController {
  constructor(private readonly console: PromptConsoleService) {}

  @Get(':capability')
  @ApiOperation({ summary: 'Load the prompt console and editable block metadata' })
  @ApiOkResponse({ description: 'Code default, active revision, and drafts.' })
  getConsole(
    @Param('capability', capabilityValidationPipe) capability: AiCapability,
  ) {
    return this.console.getConsole(capability);
  }

  @Get(':capability/revisions')
  @ApiOperation({ summary: 'List prompt revision history, newest first' })
  @ApiOkResponse({ description: 'All revisions for the capability.' })
  listRevisions(
    @Param('capability', capabilityValidationPipe) capability: AiCapability,
  ) {
    return this.console.listRevisions(capability);
  }

  @Post(':capability/revisions')
  @ApiOperation({ summary: 'Create a validated draft prompt revision' })
  @ApiCreatedResponse({ description: 'The created draft.' })
  createDraft(
    @CurrentUser() user: User,
    @Param('capability', capabilityValidationPipe) capability: AiCapability,
    @Body() input: CreatePromptRevisionDto,
  ) {
    return this.console.createDraft(capability, user.id, input);
  }

  @Patch(':capability/revisions/:id')
  @ApiOperation({ summary: 'Update a draft prompt revision' })
  @ApiOkResponse({ description: 'The updated draft; active and retired revisions return 409.' })
  updateDraft(
    @Param('capability', capabilityValidationPipe) capability: AiCapability,
    @Param('id', new ParseUUIDPipe()) revisionId: string,
    @Body() input: UpdatePromptRevisionDto,
  ) {
    return this.console.updateDraft(capability, revisionId, input);
  }

  @Post(':capability/revisions/:id/preview')
  @ApiOperation({ summary: 'Assemble candidate and active prompts without a model call' })
  @ApiOkResponse({ description: 'Side-by-side assembled prompt text.' })
  preview(
    @CurrentUser() user: User,
    @Param('capability', capabilityValidationPipe) capability: AiCapability,
    @Param('id', new ParseUUIDPipe()) revisionId: string,
  ) {
    return this.console.preview(capability, revisionId, user.id);
  }

  @Post(':capability/revisions/:id/dry-run')
  @ApiOperation({
    summary: 'Run candidate and active prompts against the admin own profile',
    description:
      'Costs two real AI evaluation calls outside fake/replay mode and persists neither result.',
  })
  @ApiOkResponse({ description: 'Two scored results and both assembled prompts.' })
  dryRun(
    @CurrentUser() user: User,
    @Param('capability', capabilityValidationPipe) capability: AiCapability,
    @Param('id', new ParseUUIDPipe()) revisionId: string,
  ) {
    return this.console.dryRun(capability, revisionId, user.id);
  }

  @Post(':capability/revisions/:id/activate')
  @ApiOperation({ summary: 'Publish or roll back to a prompt revision' })
  @ApiOkResponse({ description: 'The newly active revision.' })
  activate(
    @Param('capability', capabilityValidationPipe) capability: AiCapability,
    @Param('id', new ParseUUIDPipe()) revisionId: string,
  ) {
    return this.console.activate(capability, revisionId);
  }

  @Post(':capability/reset')
  @ApiOperation({ summary: 'Retire the active revision and restore the code default' })
  @ApiOkResponse({ description: 'No active data-backed revision remains.' })
  reset(
    @Param('capability', capabilityValidationPipe) capability: AiCapability,
  ) {
    return this.console.reset(capability);
  }
}
