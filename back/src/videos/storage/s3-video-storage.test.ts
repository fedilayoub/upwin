import { Readable } from 'node:stream';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Logger } from '@nestjs/common';
import type { S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import { createVideoS3Client, S3VideoStorage } from './s3-video-storage';

describe('S3 video storage', () => {
  function setup() {
    const send = vi.fn();
    const storage = new S3VideoStorage(
      { send } as unknown as S3Client,
      'test-bucket',
    );
    return { storage, send };
  }
  it('presigns browser UploadPart without checksum query parameters', async () => {
    const client = createVideoS3Client({
      VIDEO_STORAGE_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
      VIDEO_STORAGE_REGION: 'auto',
      VIDEO_STORAGE_ACCESS_KEY_ID: 'test-key',
      VIDEO_STORAGE_SECRET_ACCESS_KEY: 'test-secret',
      VIDEO_STORAGE_FORCE_PATH_STYLE: 'false',
    });
    try {
      const url = new URL(
        await new S3VideoStorage(client, 'test-bucket').presignUploadPart(
          'videos/user/id/raw.mp4',
          'upload',
          1,
          3600,
        ),
      );
      expect(
        [...url.searchParams.keys()].some(
          (key) =>
            key.toLowerCase().startsWith('x-amz-checksum') ||
            key.toLowerCase() === 'x-amz-sdk-checksum-algorithm',
        ),
      ).toBe(false);
      expect(url.searchParams.get('X-Amz-Expires')).toBe('3600');
    } finally {
      client.destroy();
    }
  });
  it('paginates all ListParts using string markers', async () => {
    const { storage, send } = setup();
    send
      .mockResolvedValueOnce({
        IsTruncated: true,
        NextPartNumberMarker: '1',
        Parts: [{ PartNumber: 1, Size: 8388608, ETag: '"a"' }],
      })
      .mockResolvedValueOnce({
        Parts: [{ PartNumber: 2, Size: 1, ETag: '"b"' }],
      });
    expect(await storage.listParts('videos/user/id/raw.mp4', 'upload')).toEqual(
      [
        { partNumber: 1, sizeBytes: 8388608, etag: '"a"' },
        { partNumber: 2, sizeBytes: 1, etag: '"b"' },
      ],
    );
    expect((send.mock.calls[1]?.[0] as { input: unknown }).input).toMatchObject(
      { PartNumberMarker: '1' },
    );
  });
  it('completes with authoritative ETags, and treats NoSuchUpload as a successful abort', async () => {
    const { storage, send } = setup();
    send.mockResolvedValueOnce({});
    await storage.completeMultipartUpload('videos/u/id/raw.mp4', 'up', [
      { partNumber: 1, etag: '"tag"' },
    ]);
    expect((send.mock.calls[0]?.[0] as { input: unknown }).input).toMatchObject(
      { MultipartUpload: { Parts: [{ PartNumber: 1, ETag: '"tag"' }] } },
    );
    send.mockRejectedValueOnce(
      Object.assign(new Error('private'), { name: 'NoSuchUpload' }),
    );
    await expect(
      storage.abortMultipartUpload('videos/u/id/raw.mp4', 'up'),
    ).resolves.toBeUndefined();
  });
  it('sets immutable private caching and an explicit ContentLength on streamed PUT', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'video-storage-'));
    try {
      const file = join(dir, 'playback.mp4');
      await writeFile(file, 'bytes');
      const { storage, send } = setup();
      send.mockResolvedValue({ UploadId: 'up' });
      await storage.createMultipartUpload('videos/u/id/raw.mp4', 'video/mp4');
      await storage.uploadFile('videos/u/id/playback.mp4', file, 'video/mp4');
      expect(
        (send.mock.calls[0]?.[0] as { input: unknown }).input,
      ).toMatchObject({
        ContentType: 'video/mp4',
        CacheControl: 'private, max-age=31536000, immutable',
      });
      expect(
        (send.mock.calls[1]?.[0] as { input: unknown }).input,
      ).toMatchObject({
        ContentLength: 5,
        ContentType: 'video/mp4',
        CacheControl: 'private, max-age=31536000, immutable',
      });
      // Opened read streams settle after destroy before the temp directory is removed.
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('streams downloads, rejects excess bytes, and aborts the request', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'video-download-'));
    try {
      const { storage, send } = setup();
      send.mockResolvedValueOnce({ Body: Readable.from([Buffer.from('abc')]) });
      expect(
        await storage.downloadToFile(
          'videos/u/id/raw.mp4',
          join(dir, 'raw'),
          3,
        ),
      ).toBe(3);
      expect(await readFile(join(dir, 'raw'), 'utf8')).toBe('abc');
      send.mockResolvedValueOnce({ Body: Readable.from([Buffer.alloc(10)]) });
      await expect(
        storage.downloadToFile('videos/u/id/raw.mp4', join(dir, 'large'), 3),
      ).rejects.toMatchObject({
        status: 502,
        response: { code: 'VIDEO_STORAGE_ERROR' },
      });
      expect(
        (send.mock.calls[1]?.[1] as { abortSignal: AbortSignal }).abortSignal
          .aborted,
      ).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('paginates prefix deletion in batches of 1000 and checks per-object errors', async () => {
    const { storage, send } = setup();
    send
      .mockResolvedValueOnce({
        Contents: Array.from({ length: 1000 }, (_, i) => ({
          Key: `videos/u/id/${i}`,
        })),
        IsTruncated: true,
        NextContinuationToken: 'next',
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Contents: [{ Key: 'videos/u/id/1000' }] })
      .mockResolvedValueOnce({});
    await storage.deletePrefix('videos/u/id/');
    expect(send).toHaveBeenCalledTimes(4);
    expect((send.mock.calls[2]?.[0] as { input: unknown }).input).toMatchObject(
      { ContinuationToken: 'next' },
    );
    send
      .mockResolvedValueOnce({ Contents: [{ Key: 'videos/u/id/1' }] })
      .mockResolvedValueOnce({ Errors: [{ Code: 'AccessDenied' }] });
    await expect(storage.deletePrefix('videos/u/id/')).rejects.toMatchObject({
      status: 502,
    });
  });
  it('refuses a prefix wider than one video without calling storage', async () => {
    const { storage, send } = setup();
    const log = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      for (const prefix of [
        '',
        'videos/',
        'videos/u/',
        'videos/u/id',
        'other/u/id/',
        'videos/u/id/poster.jpg',
      ]) {
        await expect(storage.deletePrefix(prefix)).rejects.toMatchObject({
          status: 502,
        });
      }
      expect(send).not.toHaveBeenCalled();
      send.mockResolvedValueOnce({ Contents: [] });
      await storage.deletePrefix('videos/u/id/raw.mp4');
      expect(send).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });
  it('maps unusable responses and SDK failures without logging URLs or messages', async () => {
    const { storage, send } = setup();
    const log = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      send.mockRejectedValueOnce(
        Object.assign(new Error('https://secret.test/?signature=private'), {
          name: 'AccessDenied',
        }),
      );
      await expect(
        storage.createMultipartUpload('videos/u/id/raw.mp4', 'video/mp4'),
      ).rejects.toMatchObject({ response: { code: 'VIDEO_STORAGE_ERROR' } });
      expect(log).toHaveBeenCalledWith('Video id: AccessDenied');
      expect(JSON.stringify(log.mock.calls)).not.toContain('signature');
      send.mockResolvedValueOnce({});
      await expect(
        storage.createMultipartUpload('videos/u/id/raw.mp4', 'video/mp4'),
      ).rejects.toMatchObject({ status: 502 });
    } finally {
      log.mockRestore();
    }
  });
});
