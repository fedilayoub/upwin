import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Public } from '../auth/public.decorator';
import { VideosService } from './videos.service';
@Public()
@Controller('public/videos')
export class PublicVideosController {
  constructor(private readonly videos: VideosService) {}
  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  get(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    reply.header('Cache-Control', 'no-store');
    return this.videos.publicVideo(slug);
  }
  /** Always 200: `{ counted, owner, viewId }`. `viewId` reports this view's progress. */
  @Post(':slug/views')
  @HttpCode(200)
  view(
    @Param('slug') slug: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.videos.view(slug, authorization);
  }
  /** Always 204, whatever the input: the share page learns nothing from it. */
  @Post(':slug/views/:viewId/progress')
  @HttpCode(204)
  async progress(
    @Param('slug') slug: string,
    @Param('viewId') viewId: string,
    @Body() body: unknown,
  ) {
    await this.videos.viewProgress(slug, viewId, body);
  }
}
