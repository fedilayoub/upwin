import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../database/schema';

interface MeResponse {
  id: string;
  createdAt: string;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  @Get()
  @ApiOperation({ summary: 'Return the local user' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['id', 'createdAt'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  getMe(@CurrentUser() user: User): MeResponse {
    return {
      id: user.id,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
