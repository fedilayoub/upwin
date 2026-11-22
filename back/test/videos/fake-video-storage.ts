import { readFile, writeFile } from 'node:fs/promises';
import { vi } from 'vitest';
import type {
  CompletedPart,
  UploadedPart,
  VideoStorage,
} from '../../src/videos/storage/video-storage';
export class FakeVideoStorage implements VideoStorage {
  readonly objects = new Map<string, Buffer>();
  readonly uploads = new Map<string, UploadedPart[]>();
  createMultipartUpload = vi.fn(async (_key: string, _type: 'video/mp4') => {
    void _key;
    void _type;
    const uploadId = `upload-${this.uploads.size}`;
    this.uploads.set(uploadId, []);
    return { uploadId };
  });
  presignUploadPart = vi.fn(
    async (
      _key: string,
      _uploadId: string,
      partNumber: number,
      _ttl: number,
    ) => {
      void _key;
      void _uploadId;
      void _ttl;
      return `https://storage.test/part-${partNumber}`;
    },
  );
  listParts = vi.fn(
    async (_key: string, uploadId: string) => this.uploads.get(uploadId) ?? [],
  );
  completeMultipartUpload = vi.fn(
    async (_key: string, _uploadId: string, _parts: CompletedPart[]) => {
      void _key;
      void _uploadId;
      void _parts;
      return undefined;
    },
  );
  abortMultipartUpload = vi.fn(async (_key: string, uploadId: string) => {
    this.uploads.delete(uploadId);
  });
  presignGet = vi.fn(async (key: string, _ttl: number) => {
    void _ttl;
    return `https://storage.test/${key}`;
  });
  downloadToFile = vi.fn(
    async (key: string, path: string, maxBytes: number) => {
      const bytes = this.objects.get(key);
      if (!bytes || bytes.length > maxBytes)
        throw new Error('Fake storage download failed');
      await writeFile(path, bytes);
      return bytes.length;
    },
  );
  uploadFile = vi.fn(
    async (key: string, path: string, _type: 'video/mp4' | 'image/jpeg') => {
      void _type;
      this.objects.set(key, await readFile(path));
    },
  );
  deletePrefix = vi.fn(async (prefix: string) => {
    for (const key of this.objects.keys())
      if (key.startsWith(prefix)) this.objects.delete(key);
  });
}
