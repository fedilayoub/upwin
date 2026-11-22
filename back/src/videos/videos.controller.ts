import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../database/schema';
import {
  createVideoSchema,
  completeVideoSchema,
  presignPartsSchema,
  updateVideoSchema,
  videoListSchema,
} from './videos.schema';
import { videoError } from './video.errors';
import { VideosService } from './videos.service';

function parse<T>(
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: T } | { success: false };
  },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) throw videoError('VALIDATION_FAILED');
  return result.data;
}
@ApiTags('videos')
@ApiBearerAuth()
@Controller('videos')
export class VideosController {
  constructor(private readonly videos: VideosService) {}
  @Get('limits') limits(@CurrentUser() user: User) {
    return this.videos.limits(user.id);
  }
  @Post() create(@CurrentUser() user: User, @Body() body: unknown) {
    return this.videos.create(user.id, parse(createVideoSchema, body));
  }
  @Post(':id/upload-parts')
  @HttpCode(200)
  presign(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.videos.presignParts(
      user.id,
      id,
      parse(presignPartsSchema, body).partNumbers,
    );
  }
  @Get(':id/upload-parts') parts(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.videos.listParts(user.id, id);
  }
  @Post(':id/complete')
  @HttpCode(200)
  complete(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.videos.complete(user.id, id, parse(completeVideoSchema, body));
  }
  @Delete(':id/upload')
  @HttpCode(204)
  abort(@CurrentUser() user: User, @Param('id') id: string) {
    return this.videos.abort(user.id, id);
  }
  @Get() list(@CurrentUser() user: User, @Query() query: unknown) {
    return this.videos.list(user.id, parse(videoListSchema, query));
  }
  @Get(':id') get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.videos.get(user.id, id);
  }
  @Patch(':id') update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.videos.update(
      user.id,
      id,
      parse(updateVideoSchema, body).title,
    );
  }
  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.videos.delete(user.id, id);
  }
}
