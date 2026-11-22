import { describe, expect } from 'vitest';
import {
  OWNER_API_TOKEN,
  USER_ID,
  VIDEO_ID,
  videoRow,
} from '../../test/videos/video-test-helpers';
import { setup } from '../../test/videos/setup-videos';
import { it } from 'vitest';

const input = {
  sourceKind: 'screen',
  hasCamera: false,
  hasAudio: true,
  mimeType: 'video/mp4',
} as const;
const complete = {
  parts: [
    { partNumber: 1, etag: '"a"' },
    { partNumber: 2, etag: '"b"' },
  ],
  clientDurationMs: 1000,
};
describe('videos service', () => {
  it('creates an upload with the install limits and keeps server keys private', async () => {
    const s = setup();
    const result = await s.service.create(USER_ID, input);
    expect(result.upload).toEqual({
      partSizeBytes: 8388608,
      maxParts: 76,
      maxBytes: 76 * 8388608,
      maxDurationMs: 1_200_000,
    });
    expect(result.video).toMatchObject({
      status: 'uploading',
      thumbnailUrl: null,
    });
    expect(result.video.title).toBe('Sam R. has something to show you');
    expect(s.storage.createMultipartUpload.mock.calls[0]?.[0]).toBe(
      `videos/${USER_ID}/${result.video.id}/raw.mp4`,
    );
    expect(result.video.shareUrl).toBe(
      `http://localhost:3000/v/${result.video.slug}`,
    );
    expect(JSON.stringify(result)).not.toMatch(/uploadId|storagePrefix/);
  });
  it('titles a recording after its owner, the job, or the title the client sent', async () => {
    const s = setup();
    const forJob = await s.service.create(USER_ID, {
      ...input,
      jobSnapshotId: VIDEO_ID,
    });
    expect(forJob.video.title).toBe(
      'Sam R. has something to show you about your project',
    );
    s.repository.ownerName.mockResolvedValueOnce(null);
    const unnamed = await s.service.create(USER_ID, input);
    expect(unnamed.video.title).toBe('I have something to show you');
    const custom = await s.service.create(USER_ID, {
      ...input,
      title: 'Homepage audit',
    });
    expect(custom.video.title).toBe('Homepage audit');
  });

  it('retries a slug collision without creating multipart twice', async () => {
    const s = setup();
    s.repository.insert.mockRejectedValueOnce(
      Object.assign(new Error('unique'), {
        code: '23505',
        constraint: 'videos_slug_unique',
      }),
    );
    await s.service.create(USER_ID, input);
    expect(s.repository.insert).toHaveBeenCalledTimes(2);
    expect(s.storage.createMultipartUpload).toHaveBeenCalledOnce();
  });
  it('aborts the multipart upload when the insert fails', async () => {
    const s = setup();
    s.repository.insert.mockRejectedValueOnce(new Error('database'));
    await expect(s.service.create(USER_ID, input)).rejects.toThrow();
    expect(s.storage.abortMultipartUpload).toHaveBeenCalledOnce();
  });
  it('checks the owned job before allocating storage', async () => {
    const s = setup();
    s.repository.ownsJob.mockResolvedValueOnce(false);
    await expect(
      s.service.create(USER_ID, { ...input, jobSnapshotId: VIDEO_ID }),
    ).rejects.toMatchObject({ response: { code: 'VIDEO_NOT_FOUND' } });
    expect(s.storage.createMultipartUpload).not.toHaveBeenCalled();
  });
  it('reports the per-video caps and the storage in use, with no total cap', async () => {
    const s = setup();
    s.repository.storageUsed.mockResolvedValue(500 * 1073741824);
    expect(await s.service.limits(USER_ID)).toEqual({
      available: true,
      storage: { usedBytes: 500 * 1073741824 },
      maxDurationMs: 1_200_000,
      maxBytes: 76 * 8388608,
    });
    await expect(s.service.create(USER_ID, input)).resolves.toBeDefined();
  });
  it('still reports limits when no bucket is configured', async () => {
    const s = setup({}, false);
    expect(await s.service.limits(USER_ID)).toMatchObject({
      available: false,
      maxDurationMs: 1_200_000,
    });
  });
  it('rejects mutations when disabled', async () => {
    const s = setup({}, false);
    for (const call of [
      () => s.service.create(USER_ID, input),
      () => s.service.presignParts(USER_ID, VIDEO_ID, [1]),
      () => s.service.listParts(USER_ID, VIDEO_ID),
      () => s.service.complete(USER_ID, VIDEO_ID, complete),
      () => s.service.abort(USER_ID, VIDEO_ID),
    ])
      await expect(call()).rejects.toMatchObject({
        status: 503,
        response: { code: 'VIDEO_NOT_CONFIGURED' },
      });
  });
  it('returns ownership 404s', async () => {
    const s = setup({ userId: 'different' });
    for (const call of [
      () => s.service.get(USER_ID, VIDEO_ID),
      () => s.service.presignParts(USER_ID, VIDEO_ID, [1]),
      () => s.service.complete(USER_ID, VIDEO_ID, complete),
      () => s.service.abort(USER_ID, VIDEO_ID),
      () => s.service.delete(USER_ID, VIDEO_ID),
      () => s.service.update(USER_ID, VIDEO_ID, 'title'),
    ])
      await expect(call()).rejects.toMatchObject({
        status: 404,
        response: { code: 'VIDEO_NOT_FOUND' },
      });
  });
  it.each(
    [[], [0], [21], [1, 1], Array.from({ length: 11 }, (_, i) => i + 1)].map(
      (numbers) => [numbers],
    ),
  )('rejects invalid part selection %j', async (numbers) => {
    await expect(
      setup().service.presignParts(USER_ID, VIDEO_ID, numbers),
    ).rejects.toMatchObject({
      status: 413,
      response: { code: 'VIDEO_TOO_LARGE' },
    });
  });
  it('signs valid parts with a 1h TTL and lists authoritative stored parts', async () => {
    const s = setup();
    expect(
      (await s.service.presignParts(USER_ID, VIDEO_ID, [1, 20])).parts,
    ).toHaveLength(2);
    expect(s.storage.presignUploadPart).toHaveBeenCalledWith(
      `${s.row.storagePrefix}raw.mp4`,
      'upload-0',
      20,
      3600,
    );
    expect((await s.service.listParts(USER_ID, VIDEO_ID)).parts).toHaveLength(
      2,
    );
  });
  it('completes once with server ETags, kicks processing, and is idempotent', async () => {
    const s = setup();
    const result = await s.service.complete(USER_ID, VIDEO_ID, complete);
    expect(result.video.status).toBe('processing');
    expect(s.processor.kick).toHaveBeenCalledOnce();
    expect(s.storage.completeMultipartUpload).toHaveBeenCalledWith(
      `${s.row.storagePrefix}raw.mp4`,
      'upload-0',
      await s.storage.listParts('', 'upload-0'),
    );
    expect(
      (await s.service.complete(USER_ID, VIDEO_ID, complete)).video.status,
    ).toBe('processing');
    expect(s.storage.completeMultipartUpload).toHaveBeenCalledOnce();
  });
  it.each([
    'empty',
    'gap',
    'short-middle',
    'zero-last',
    'large-last',
    'etag',
    'missing-client',
    'order',
  ] as const)('rejects %s and leaves uploading resumable', async (kind) => {
    const s = setup();
    const parts = structuredClone(s.storage.uploads.get('upload-0')!);
    const request = structuredClone(complete);
    if (kind === 'empty') parts.splice(0);
    if (kind === 'gap') parts[1]!.partNumber = 3;
    if (kind === 'short-middle') parts[0]!.sizeBytes = 1;
    if (kind === 'zero-last') parts[1]!.sizeBytes = 0;
    if (kind === 'large-last') parts[1]!.sizeBytes = 8388609;
    if (kind === 'etag') request.parts[0]!.etag = 'wrong';
    if (kind === 'missing-client') request.parts.pop();
    if (kind === 'order') request.parts.reverse();
    s.storage.uploads.set('upload-0', parts);
    await expect(
      s.service.complete(USER_ID, VIDEO_ID, request),
    ).rejects.toMatchObject({
      status: 422,
      response: { code: 'VIDEO_UPLOAD_INVALID' },
    });
    expect(s.repository.rows.get(VIDEO_ID)?.status).toBe('uploading');
    expect(s.storage.completeMultipartUpload).not.toHaveBeenCalled();
  });
  it('fails an oversized upload, aborts and purges it', async () => {
    const s = setup();
    s.storage.uploads.set('upload-0', [
      { partNumber: 1, sizeBytes: s.row.maxBytes + 1, etag: 'a' },
    ]);
    await expect(
      s.service.complete(USER_ID, VIDEO_ID, complete),
    ).rejects.toMatchObject({ status: 413 });
    expect(s.repository.rows.get(VIDEO_ID)).toMatchObject({
      status: 'failed',
      failureReason: 'invalid_media',
    });
    expect(s.storage.abortMultipartUpload).toHaveBeenCalledOnce();
    expect(s.storage.deletePrefix).toHaveBeenCalled();
    await s.service.delete(USER_ID, VIDEO_ID);
  });
  it('aborts the upload and deletes the row', async () => {
    const s = setup();
    await s.service.abort(USER_ID, VIDEO_ID);
    expect(s.repository.rows.size).toBe(0);
  });
  it.each(['processing', 'ready', 'failed'] as const)(
    'rejects part/abort calls for %s',
    async (status) => {
      const s = setup({ status });
      for (const call of [
        () => s.service.presignParts(USER_ID, VIDEO_ID, [1]),
        () => s.service.listParts(USER_ID, VIDEO_ID),
        () => s.service.abort(USER_ID, VIDEO_ID),
      ])
        await expect(call()).rejects.toMatchObject({ status: 409 });
      if (status === 'failed')
        await expect(
          s.service.complete(USER_ID, VIDEO_ID, complete),
        ).rejects.toMatchObject({ status: 409 });
      if (status === 'ready')
        expect(
          (await s.service.complete(USER_ID, VIDEO_ID, complete)).video.status,
        ).toBe('ready');
    },
  );
  it.each(['uploading', 'failed', 'processing', 'ready'] as const)(
    'owner deletion %s marks the row and defers storage failure',
    async (status) => {
      const s = setup({ status });
      s.storage.deletePrefix.mockRejectedValueOnce(new Error('down'));
      await s.service.delete(USER_ID, VIDEO_ID);
      const row = s.repository.rows.get(VIDEO_ID);
      expect(row?.deletedAt).toBeInstanceOf(Date);
      expect(row?.storagePurgedAt).toBeNull();
    },
  );
  it.each([
    'uploading',
    'failed',
    'deleted',
    'orphan',
    'invalid',
    'missing',
  ] as const)('public %s returns 404', async (state) => {
    const s = setup(
      state === 'uploading' || state === 'failed'
        ? { status: state }
        : state === 'orphan'
          ? { userId: null }
          : { status: 'ready', deletedAt: new Date() },
    );
    await expect(
      s.service.publicVideo(
        state === 'invalid'
          ? 'bad'
          : state === 'missing'
            ? 'ZZZZZZZZZZZZ'
            : s.row.slug,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('returns null URLs during processing', async () => {
    const s = setup({ status: 'processing' });
    expect(await s.service.publicVideo(s.row.slug)).toMatchObject({
      status: 'processing',
      playbackUrl: null,
      posterUrl: null,
    });
  });
  it('exposes only validated playback for 3h, without owner fields', async () => {
    const s = setup({ status: 'ready', playbackReady: true });
    const result = await s.service.publicVideo(s.row.slug);
    expect(s.storage.presignGet).toHaveBeenCalledWith(
      `${s.row.storagePrefix}playback.mp4`,
      10800,
    );
    expect(s.storage.presignGet).toHaveBeenCalledWith(
      `${s.row.storagePrefix}poster.jpg`,
      10800,
    );
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('id');
    await s.service.get(USER_ID, VIDEO_ID);
    expect(s.storage.presignGet).toHaveBeenCalledWith(
      `${s.row.storagePrefix}poster.jpg`,
      3600,
    );
    expect(
      s.storage.presignGet.mock.calls.some((c) => c[0].endsWith('raw.mp4')),
    ).toBe(false);
  });
  it('excludes plays by the API token holder and counts everyone else', async () => {
    const s = setup({ status: 'ready' });
    expect(
      await s.service.view(s.row.slug, `Bearer ${OWNER_API_TOKEN}`),
    ).toEqual({ counted: false, owner: true, viewId: null });
    expect(s.repository.recordView).not.toHaveBeenCalled();
    expect(await s.service.view(s.row.slug, 'Bearer someone-else')).toEqual({
      counted: true,
      owner: false,
      viewId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa99',
    });
    await s.service.view(s.row.slug, 'Basic nope');
    await s.service.view(s.row.slug);
    expect(await s.service.view('invalid')).toMatchObject({ counted: false });
    expect(s.repository.recordView).toHaveBeenCalledTimes(3);
    s.repository.recordView.mockResolvedValueOnce(null);
    expect(await s.service.view(s.row.slug)).toEqual({
      counted: false,
      owner: false,
      viewId: null,
    });
  });
  it('counts every play when the API has no token to recognise the owner', async () => {
    const s = setup({ status: 'ready' }, true, { API_TOKEN: undefined });
    await s.service.view(s.row.slug, `Bearer ${OWNER_API_TOKEN}`);
    expect(s.repository.recordView).toHaveBeenCalledOnce();
  });  it('records progress only for a well-formed view and payload', async () => {
    const s = setup({ status: 'ready' });
    const viewId = '018f6a77-4e90-7ab5-a3bf-15c8f850fa99';
    await s.service.viewProgress(s.row.slug, viewId, {
      watchedMs: 4200,
      finished: false,
    });
    expect(s.repository.recordProgress).toHaveBeenCalledWith(
      s.row.slug,
      viewId,
      4200,
      false,
    );
    await s.service.viewProgress('bad', viewId, { watchedMs: 1, finished: true });
    await s.service.viewProgress(s.row.slug, 'not-a-uuid', {
      watchedMs: 1,
      finished: true,
    });
    await s.service.viewProgress(s.row.slug, viewId, { watchedMs: -5 });
    await s.service.viewProgress(s.row.slug, viewId, 'junk');
    expect(s.repository.recordProgress).toHaveBeenCalledTimes(1);
  });
  it('returns watch stats with every owner video', async () => {
    const s = setup({ status: 'ready' });
    s.repository.watchStats.mockResolvedValue(
      new Map([
        [
          s.row.id,
          { finishedViews: 2, averageWatchedPercent: 74, watchTimeMs: 21000 },
        ],
      ]),
    );
    const { video } = await s.service.get(USER_ID, s.row.id);
    expect(video).toMatchObject({
      finishedViews: 2,
      averageWatchedPercent: 74,
      watchTimeMs: 21000,
    });
    s.repository.watchStats.mockResolvedValue(new Map());
    expect((await s.service.get(USER_ID, s.row.id)).video).toMatchObject({
      finishedViews: 0,
      averageWatchedPercent: null,
      watchTimeMs: 0,
    });
  });
  it('encodes a seek cursor and rejects malformed cursors', async () => {
    const s = setup({ status: 'ready' });
    s.repository.list.mockResolvedValue([s.row, videoRow({ id: USER_ID })]);
    const result = await s.service.list(USER_ID, { limit: 1 });
    expect(
      JSON.parse(
        Buffer.from(result.nextCursor!, 'base64url').toString(),
      ) as unknown,
    ).toEqual({ createdAt: s.row.createdAt.toISOString(), id: s.row.id });
    await s.service.list(USER_ID, { limit: 1, cursor: result.nextCursor! });
    expect(s.repository.list).toHaveBeenLastCalledWith(
      USER_ID,
      1,
      { createdAt: s.row.createdAt.toISOString(), id: s.row.id },
      undefined,
    );
    await expect(
      s.service.list(USER_ID, { limit: 20, cursor: 'bad' }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_FAILED' } });
  });
});
