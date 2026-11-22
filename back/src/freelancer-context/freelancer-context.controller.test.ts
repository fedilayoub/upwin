import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import multipart from '@fastify/multipart';
import type { FastifyRequest } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from '../common/api-exception.filter';
import type { User } from '../database/schema';
import { CvExtractionService } from './cv-extraction.service';
import {
  CV_MAX_FILE_BYTES,
  type CvUpload,
  CvTextService,
  PDF_CONTENT_TYPE,
} from './cv-text.service';
import { FreelancerContextController } from './freelancer-context.controller';
import type { FreelancerContextFields } from './freelancer-context.schema';
import { FreelancerContextService } from './freelancer-context.service';

const USER: User = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a',
  createdAt: new Date('2026-08-20T10:00:00.000Z'),
  updatedAt: new Date('2026-08-20T10:00:00.000Z'),
};
const fixturePath = resolve(process.cwd(), 'test/fixtures/text-layer-cv.pdf');
const apps: NestFastifyApplication[] = [];

const fixedDraft = {
  experience: { years: 6, roles: [] },
  skills: ['React', 'TypeScript'],
  portfolio: [],
  preferences: {},
  positioning: { targetRole: 'Senior Frontend Engineer' },
};

@Injectable()
class TestUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    request.currentUser = USER;
    return true;
  }
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('POST /freelancer-context/cv', () => {
  it('accepts a real text-layer PDF and returns an unconfirmed draft', async () => {
    const pdf = await readFile(fixturePath);
    const { app, extract, saveCvDraft } = await createApp();
    const multipartBody = makeMultipartBody(pdf, PDF_CONTENT_TYPE, 'cv.pdf');

    const response = await app.inject({
      method: 'POST',
      url: '/freelancer-context/cv',
      headers: { 'content-type': multipartBody.contentType },
      payload: multipartBody.payload,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      source: 'cv',
      confirmedAt: null,
      replaced: false,
      skills: ['React', 'TypeScript'],
    });
    expect(extract).toHaveBeenCalledOnce();
    expect(saveCvDraft).toHaveBeenCalledWith(USER.id, fixedDraft);
  });

  it('rejects attacker-supplied PDF content type when the magic bytes disagree', async () => {
    const { app, saveCvDraft } = await createApp();
    const multipartBody = makeMultipartBody(
      Buffer.from('MZ attacker bytes'),
      PDF_CONTENT_TYPE,
      'attack.pdf',
    );

    const response = await app.inject({
      method: 'POST',
      url: '/freelancer-context/cv',
      headers: { 'content-type': multipartBody.contentType },
      payload: multipartBody.payload,
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: { code: 'CV_INVALID', message: 'The uploaded file is not a PDF.' },
    });
    expect(saveCvDraft).not.toHaveBeenCalled();
  });

  it('rejects an upload over 5 MB before extraction', async () => {
    const { app, extract, saveCvDraft } = await createApp();
    const oversized = Buffer.alloc(CV_MAX_FILE_BYTES + 1, 0x20);
    oversized.write('%PDF-', 0, 'ascii');
    const multipartBody = makeMultipartBody(
      oversized,
      PDF_CONTENT_TYPE,
      'large.pdf',
    );

    const response = await app.inject({
      method: 'POST',
      url: '/freelancer-context/cv',
      headers: { 'content-type': multipartBody.contentType },
      payload: multipartBody.payload,
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      error: {
        code: 'CV_TOO_LARGE',
        message: 'The CV must be 5 MB or smaller.',
      },
    });
    expect(extract).not.toHaveBeenCalled();
    expect(saveCvDraft).not.toHaveBeenCalled();
  });
});

describe('DELETE /freelancer-context', () => {
  it('returns 204 both when deleting a context and when retrying with none', async () => {
    const { app, deleteContext } = await createApp();

    const firstResponse = await app.inject({
      method: 'DELETE',
      url: '/freelancer-context',
    });
    const retryResponse = await app.inject({
      method: 'DELETE',
      url: '/freelancer-context',
    });

    expect(firstResponse.statusCode).toBe(204);
    expect(firstResponse.body).toBe('');
    expect(retryResponse.statusCode).toBe(204);
    expect(retryResponse.body).toBe('');
    expect(deleteContext).toHaveBeenCalledTimes(2);
    expect(deleteContext).toHaveBeenNthCalledWith(1, USER.id);
    expect(deleteContext).toHaveBeenNthCalledWith(2, USER.id);
  });
});

async function createApp() {
  const text = new CvTextService();
  const extract = vi.fn(async (upload: CvUpload) => {
    await text.extract(upload);
    return fixedDraft;
  });
  const saveCvDraft = vi.fn(
    async (_userId: string, fields: FreelancerContextFields) => ({
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c',
      ...fields,
      source: 'cv' as const,
      confirmedAt: null,
      createdAt: '2026-08-20T10:00:00.000Z',
      updatedAt: '2026-08-20T10:00:00.000Z',
      replaced: false,
    }),
  );
  const deleteContext = vi.fn(async (_userId: string): Promise<void> => {
    void _userId;
  });
  const testingModule = await Test.createTestingModule({
    controllers: [FreelancerContextController],
    providers: [
      { provide: APP_GUARD, useClass: TestUserGuard },
      { provide: CvExtractionService, useValue: { extract } },
      {
        provide: FreelancerContextService,
        useValue: { delete: deleteContext, saveCvDraft },
      },
    ],
  }).compile();
  const app = testingModule.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.register(multipart);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  apps.push(app);

  return { app, deleteContext, extract, saveCvDraft };
}

function makeMultipartBody(buffer: Buffer, mimetype: string, filename: string) {
  const boundary = 'upilot-phase-2a-boundary';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimetype}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload: Buffer.concat([head, buffer, tail]),
  };
}
