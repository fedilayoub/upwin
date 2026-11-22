import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../database/schema';
import {
  type CreateProfileSnapshotResponse,
  type ProfileSnapshotDiffResponse,
  ProfileSnapshotsService,
} from './profile-snapshots.service';

@ApiTags('profile snapshots')
@ApiBearerAuth()
@Controller('profile-snapshots')
export class ProfileSnapshotsController {
  constructor(private readonly snapshots: ProfileSnapshotsService) {}

  @Get('diff')
  @ApiOperation({
    summary: 'Diff the two newest explicitly captured snapshots',
  })
  @ApiOkResponse({
    description:
      'A deterministic diff, or null when fewer than two snapshots exist.',
  })
  diff(@CurrentUser() user: User): Promise<ProfileSnapshotDiffResponse | null> {
    return this.snapshots.diff(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Persist a validated profile snapshot' })
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      required: ['id', 'capturedAt', 'createdAt', 'truncatedFields'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        capturedAt: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
        truncatedFields: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    description: 'The snapshot failed validation.',
  })
  create(
    @CurrentUser() user: User,
    @Body() body: unknown,
  ): Promise<CreateProfileSnapshotResponse> {
    return this.snapshots.create(user.id, body);
  }
}
