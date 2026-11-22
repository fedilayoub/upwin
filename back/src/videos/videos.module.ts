import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { videoConfigured, type Env } from '../config/env.schema';
import { FfmpegMediaTools } from './processing/ffmpeg-media-tools';
import { MEDIA_TOOLS, type MediaTools } from './processing/media-tools';
import { VideoProcessor } from './processing/video-processor';
import { PublicVideosController } from './public-videos.controller';
import {
  createVideoS3Client,
  S3VideoStorage,
} from './storage/s3-video-storage';
import { VIDEO_STORAGE, type VideoStorage } from './storage/video-storage';
import { VideoReaper } from './video-reaper';
import { VideosController } from './videos.controller';
import { VideosRepository } from './videos.repository';
import { VideosService } from './videos.service';
@Module({
  controllers: [VideosController, PublicVideosController],
  providers: [
    VideosRepository,
    VideosService,
    VideoProcessor,
    VideoReaper,
    {
      provide: VIDEO_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const env = {
          VIDEO_STORAGE_ENDPOINT: config.get('VIDEO_STORAGE_ENDPOINT', {
            infer: true,
          }),
          VIDEO_STORAGE_BUCKET: config.get('VIDEO_STORAGE_BUCKET', {
            infer: true,
          }),
          VIDEO_STORAGE_ACCESS_KEY_ID: config.get(
            'VIDEO_STORAGE_ACCESS_KEY_ID',
            { infer: true },
          ),
          VIDEO_STORAGE_SECRET_ACCESS_KEY: config.get(
            'VIDEO_STORAGE_SECRET_ACCESS_KEY',
            { infer: true },
          ),
          VIDEO_STORAGE_REGION: config.getOrThrow('VIDEO_STORAGE_REGION', {
            infer: true,
          }),
          VIDEO_STORAGE_FORCE_PATH_STYLE: config.getOrThrow(
            'VIDEO_STORAGE_FORCE_PATH_STYLE',
            { infer: true },
          ),
        };
        return videoConfigured(env)
          ? new S3VideoStorage(
              createVideoS3Client(env),
              config.getOrThrow('VIDEO_STORAGE_BUCKET', { infer: true }),
            )
          : null;
      },
    },
    {
      provide: MEDIA_TOOLS,
      useFactory: () => new FfmpegMediaTools('ffmpeg', 'ffprobe'),
    },
  ],
})
export class VideosModule implements OnModuleInit {
  constructor(
    @Inject(VIDEO_STORAGE) private readonly storage: VideoStorage | null,
    @Inject(MEDIA_TOOLS) private readonly media: MediaTools,
    private readonly config: ConfigService<Env, true>,
  ) {}
  async onModuleInit() {
    if (this.storage && this.config.get('NODE_ENV', { infer: true }) !== 'test')
      await this.media.assertAvailable();
  }
}
