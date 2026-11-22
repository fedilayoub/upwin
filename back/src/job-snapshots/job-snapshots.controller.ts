import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../database/schema';
import { CreateJobSnapshotDto } from './job-snapshot.schema';
import {
  type CreateJobSnapshotResponse,
  JobSnapshotsService,
} from './job-snapshots.service';

@ApiTags('job snapshots')
@ApiBearerAuth()
@Controller('job-snapshots')
export class JobSnapshotsController {
  constructor(private readonly snapshots: JobSnapshotsService) {}

  @Post()
  @ApiOperation({ summary: 'Persist a validated job snapshot' })
  @ApiBody({ type: CreateJobSnapshotDto })
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      required: [
        'id',
        'ciphertext',
        'capturedAt',
        'createdAt',
        'truncatedFields',
      ],
      properties: {
        id: { type: 'string', format: 'uuid' },
        ciphertext: { type: 'string' },
        capturedAt: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
        truncatedFields: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    description: 'The job snapshot failed validation.',
  })
  create(
    @CurrentUser() user: User,
    @Body() body: unknown,
  ): Promise<CreateJobSnapshotResponse> {
    return this.snapshots.create(user.id, body);
  }
}
