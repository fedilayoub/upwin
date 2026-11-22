import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Logger } from '@nestjs/common';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../../config/env.schema';
import { videoError } from '../video.errors';
import type {
  CompletedPart,
  UploadedPart,
  VideoStorage,
} from './video-storage';

const CACHE_CONTROL = 'private, max-age=31536000, immutable';
/** `videos/<userId>/<videoId>/`, optionally narrowed to that video's `raw.mp4`. */
const DELETABLE_PREFIX = /^videos\/[^/]+\/[^/]+\/(?:raw\.mp4)?$/;
export function createVideoS3Client(
  env: Pick<
    Env,
    | 'VIDEO_STORAGE_ENDPOINT'
    | 'VIDEO_STORAGE_REGION'
    | 'VIDEO_STORAGE_ACCESS_KEY_ID'
    | 'VIDEO_STORAGE_SECRET_ACCESS_KEY'
    | 'VIDEO_STORAGE_FORCE_PATH_STYLE'
  >,
): S3Client {
  if (!env.VIDEO_STORAGE_ACCESS_KEY_ID || !env.VIDEO_STORAGE_SECRET_ACCESS_KEY)
    throw videoError('VIDEO_NOT_CONFIGURED');
  return new S3Client({
    endpoint: env.VIDEO_STORAGE_ENDPOINT,
    region: env.VIDEO_STORAGE_REGION,
    credentials: {
      accessKeyId: env.VIDEO_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.VIDEO_STORAGE_SECRET_ACCESS_KEY,
    },
    forcePathStyle: env.VIDEO_STORAGE_FORCE_PATH_STYLE === 'true',
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

export class S3VideoStorage implements VideoStorage {
  private readonly logger = new Logger(S3VideoStorage.name);
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  private async run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      // Neither message nor stack is safe: SDK errors can contain signed URLs.
      const name =
        error instanceof Error
          ? error.name.replace(/[^A-Za-z0-9_]/g, '').slice(0, 80)
          : 'UnknownError';
      this.logger.warn(`Video ${key.split('/')[2] ?? 'unknown'}: ${name}`);
      throw videoError('VIDEO_STORAGE_ERROR');
    }
  }

  createMultipartUpload(key: string, contentType: 'video/mp4') {
    return this.run(key, async () => {
      const result = await this.client.send(
        new CreateMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: contentType,
          CacheControl: CACHE_CONTROL,
        }),
      );
      if (!result.UploadId) throw new Error('MissingUploadId');
      return { uploadId: result.UploadId };
    });
  }
  presignUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    ttlSeconds: number,
  ) {
    return this.run(key, () =>
      getSignedUrl(
        this.client,
        new UploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: ttlSeconds },
      ),
    );
  }
  listParts(key: string, uploadId: string): Promise<UploadedPart[]> {
    return this.run(key, async () => {
      const parts: UploadedPart[] = [];
      let marker: string | undefined;
      do {
        const page = await this.client.send(
          new ListPartsCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: uploadId,
            PartNumberMarker: marker,
          }),
        );
        for (const part of page.Parts ?? []) {
          if (
            !part.PartNumber ||
            !Number.isSafeInteger(part.Size) ||
            part.Size === undefined ||
            part.Size < 0 ||
            !part.ETag
          )
            throw new Error('InvalidPart');
          parts.push({
            partNumber: part.PartNumber,
            sizeBytes: part.Size,
            etag: part.ETag,
          });
        }
        const next = page.IsTruncated ? page.NextPartNumberMarker : undefined;
        if (page.IsTruncated && (!next || next === marker))
          throw new Error('InvalidPagination');
        marker = next;
      } while (marker);
      return parts;
    });
  }
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[],
  ) {
    return this.run(key, async () => {
      await this.client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts.map((p) => ({
              PartNumber: p.partNumber,
              ETag: p.etag,
            })),
          },
        }),
      );
    });
  }
  abortMultipartUpload(key: string, uploadId: string) {
    return this.run(key, async () => {
      try {
        await this.client.send(
          new AbortMultipartUploadCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: uploadId,
          }),
        );
      } catch (error: unknown) {
        if (!(error instanceof Error && error.name === 'NoSuchUpload'))
          throw error;
      }
    });
  }
  presignGet(key: string, ttlSeconds: number) {
    return this.run(key, () =>
      getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn: ttlSeconds },
      ),
    );
  }
  downloadToFile(key: string, path: string, maxBytes: number) {
    return this.run(key, async () => {
      const abort = new AbortController();
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { abortSignal: abort.signal },
      );
      if (!(result.Body instanceof Readable))
        throw new Error('MissingObjectBody');
      const body = result.Body;
      if (
        result.ContentLength !== undefined &&
        result.ContentLength > maxBytes
      ) {
        body.destroy();
        abort.abort();
        throw new Error('ObjectTooLarge');
      }
      let bytes = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, done) {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            abort.abort();
            done(new Error('ObjectTooLarge'));
          } else done(null, chunk);
        },
      });
      await pipeline(
        body,
        limiter,
        createWriteStream(path, { flags: 'w', mode: 0o600 }),
      );
      return bytes;
    });
  }
  uploadFile(
    key: string,
    path: string,
    contentType: 'video/mp4' | 'image/jpeg',
  ) {
    return this.run(key, async () => {
      const info = await stat(path);
      const body = createReadStream(path);
      try {
        await this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentLength: info.size,
            ContentType: contentType,
            CacheControl: CACHE_CONTROL,
          }),
        );
      } finally {
        body.destroy();
      }
    });
  }
  deletePrefix(prefix: string) {
    return this.run(prefix, async () => {
      // Defence in depth: a malformed stored prefix (empty, `videos/`, one segment) must
      // never widen a delete to other users' objects or the whole bucket.
      if (!DELETABLE_PREFIX.test(prefix)) throw new Error('InvalidPrefix');
      let token: string | undefined;
      do {
        const page = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            ContinuationToken: token,
            MaxKeys: 1000,
          }),
        );
        const keys = (page.Contents ?? []).map((item) => {
          if (!item.Key || !item.Key.startsWith(prefix))
            throw new Error('InvalidObjectKey');
          return { Key: item.Key };
        });
        if (keys.length) {
          const result = await this.client.send(
            new DeleteObjectsCommand({
              Bucket: this.bucket,
              Delete: { Objects: keys, Quiet: true },
            }),
          );
          if (result.Errors?.length) throw new Error('ObjectDeletionFailed');
        }
        const next = page.IsTruncated ? page.NextContinuationToken : undefined;
        if (page.IsTruncated && (!next || next === token))
          throw new Error('InvalidPagination');
        token = next;
      } while (token);
    });
  }
}
