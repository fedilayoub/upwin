import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  PayloadTooLargeException,
  Post,
  Req,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../database/schema';
import { CvExtractionService } from './cv-extraction.service';
import { CV_MAX_FILE_BYTES, type CvUpload } from './cv-text.service';
import {
  CreateFreelancerContextDto,
  UpdateFreelancerContextDto,
} from './freelancer-context.schema';
import {
  type FreelancerContextResponse,
  type FreelancerContextSaveResponse,
  FreelancerContextService,
} from './freelancer-context.service';

@ApiTags('freelancer context')
@ApiBearerAuth()
@Controller('freelancer-context')
export class FreelancerContextController {
  constructor(
    private readonly contexts: FreelancerContextService,
    private readonly cvExtraction: CvExtractionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the current freelancer context or null' })
  @ApiOkResponse({ description: 'The current draft or confirmed context.' })
  get(@CurrentUser() user: User): Promise<FreelancerContextResponse | null> {
    return this.contexts.get(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create or replace an unconfirmed manual context' })
  @ApiCreatedResponse({ description: 'The saved unconfirmed context.' })
  create(
    @CurrentUser() user: User,
    @Body() input: CreateFreelancerContextDto,
  ): Promise<FreelancerContextSaveResponse> {
    return this.contexts.createManual(user.id, input);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete the current freelancer context' })
  @ApiNoContentResponse({ description: 'The context is absent.' })
  delete(@CurrentUser() user: User): Promise<void> {
    return this.contexts.delete(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Edit context fields and reset confirmation' })
  @ApiOkResponse({ description: 'The updated unconfirmed context.' })
  update(
    @CurrentUser() user: User,
    @Body() input: UpdateFreelancerContextDto,
  ): Promise<FreelancerContextResponse> {
    return this.contexts.update(user.id, input);
  }

  @Post('cv')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Extract and save an unconfirmed context from a CV',
  })
  @ApiCreatedResponse({ description: 'The extracted unconfirmed context.' })
  async extractCv(
    @CurrentUser() user: User,
    @Req() request: FastifyRequest,
  ): Promise<FreelancerContextSaveResponse> {
    const upload = await readCvUpload(request);
    const draft = await this.cvExtraction.extract(upload);
    return this.contexts.saveCvDraft(user.id, draft);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm the current freelancer context' })
  @ApiCreatedResponse({ description: 'The now-confirmed context.' })
  confirm(@CurrentUser() user: User): Promise<FreelancerContextResponse> {
    return this.contexts.confirm(user.id);
  }
}

async function readCvUpload(request: FastifyRequest): Promise<CvUpload> {
  if (!request.isMultipart())
    throw invalidUpload('Send the CV as multipart form data.');

  try {
    const file = await request.file({
      limits: { fields: 0, files: 1, fileSize: CV_MAX_FILE_BYTES, parts: 1 },
      throwFileSizeLimit: true,
    });

    if (!file || file.fieldname !== 'file') {
      throw invalidUpload('Attach one CV using the file field.');
    }

    return {
      filename: file.filename,
      mimetype: file.mimetype,
      buffer: await file.toBuffer(),
    };
  } catch (error: unknown) {
    if (isFastifyError(error, 'FST_REQ_FILE_TOO_LARGE')) {
      throw new PayloadTooLargeException({
        code: 'CV_TOO_LARGE',
        message: 'The CV must be 5 MB or smaller.',
      });
    }
    if (
      isFastifyError(error, 'FST_PARTS_LIMIT') ||
      isFastifyError(error, 'FST_FILES_LIMIT') ||
      isFastifyError(error, 'FST_FIELDS_LIMIT') ||
      isFastifyError(error, 'FST_MP_PREMATURE_CLOSE')
    ) {
      throw invalidUpload('Attach exactly one CV using the file field.');
    }
    throw error;
  }
}

function isFastifyError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

function invalidUpload(message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ code: 'CV_INVALID', message });
}
