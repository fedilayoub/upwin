import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  /**
   * Liveness only. It must not touch the database or any provider, so that a
   * dependency outage cannot make the process look dead to an orchestrator.
   */
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({ schema: { type: 'object', properties: { status: { type: 'string' } } } })
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
