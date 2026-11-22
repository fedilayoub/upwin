export const VIDEO_STORAGE = Symbol('VIDEO_STORAGE');
export interface UploadedPart {
  partNumber: number;
  sizeBytes: number;
  etag: string;
}
export interface CompletedPart {
  partNumber: number;
  etag: string;
}
export interface VideoStorage {
  createMultipartUpload(
    key: string,
    contentType: 'video/mp4',
  ): Promise<{ uploadId: string }>;
  presignUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    ttlSeconds: number,
  ): Promise<string>;
  listParts(key: string, uploadId: string): Promise<UploadedPart[]>;
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[],
  ): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
  presignGet(key: string, ttlSeconds: number): Promise<string>;
  downloadToFile(key: string, path: string, maxBytes: number): Promise<number>;
  uploadFile(
    key: string,
    path: string,
    contentType: 'video/mp4' | 'image/jpeg',
  ): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}
