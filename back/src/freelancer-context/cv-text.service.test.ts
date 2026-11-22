import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CV_MAX_FILE_BYTES,
  CvTextService,
  DOCX_CONTENT_TYPE,
  PDF_CONTENT_TYPE,
} from './cv-text.service';

const fixturePath = resolve(process.cwd(), 'test/fixtures/text-layer-cv.pdf');

describe('CvTextService', () => {
  const service = new CvTextService();

  it('extracts text from the real PDF fixture', async () => {
    const buffer = await readFile(fixturePath);

    await expect(
      service.extract({
        filename: 'cv.pdf',
        mimetype: PDF_CONTENT_TYPE,
        buffer,
      }),
    ).resolves.toContain(
      'Six years building React and TypeScript SaaS products.',
    );
  });

  it('rejects a declared PDF whose magic bytes do not match', async () => {
    await expect(
      service.extract({
        filename: 'attack.pdf',
        mimetype: PDF_CONTENT_TYPE,
        buffer: Buffer.from('MZ attacker-controlled bytes'),
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'CV_INVALID',
        message: 'The uploaded file is not a PDF.',
      },
      status: 422,
    });
  });

  it('rejects valid PDF bytes under an unsupported declared content type', async () => {
    const buffer = await readFile(fixturePath);

    await expect(
      service.extract({ filename: 'cv.png', mimetype: 'image/png', buffer }),
    ).rejects.toMatchObject({
      response: { code: 'CV_INVALID', message: 'Upload a PDF or DOCX CV.' },
      status: 422,
    });
  });

  it('rejects a generic ZIP renamed to DOCX', async () => {
    await expect(
      service.extract({
        filename: 'cv.docx',
        mimetype: DOCX_CONTENT_TYPE,
        buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]),
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'CV_INVALID',
        message: 'The uploaded file is not a valid DOCX document.',
      },
      status: 422,
    });
  });

  it('rejects files over 5 MB before parsing', async () => {
    await expect(
      service.extract({
        filename: 'large.pdf',
        mimetype: PDF_CONTENT_TYPE,
        buffer: Buffer.alloc(CV_MAX_FILE_BYTES + 1),
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'CV_TOO_LARGE',
        message: 'The CV must be 5 MB or smaller.',
      },
      status: 413,
    });
  });

  it('surfaces a clear error when the PDF has no text layer', async () => {
    const buffer = await readFile(fixturePath);
    const streamStart = buffer.indexOf(Buffer.from('BT\n'));
    const streamEnd = buffer.indexOf(Buffer.from('ET\n')) + 3;
    const noTextLayer = Buffer.from(buffer);
    noTextLayer.fill(0x20, streamStart, streamEnd);

    await expect(
      service.extract({
        filename: 'scanned.pdf',
        mimetype: PDF_CONTENT_TYPE,
        buffer: noTextLayer,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'CV_TEXT_NOT_FOUND',
        message:
          'No readable text layer was found. Upload a text-based CV or enter your details manually.',
      },
      status: 422,
    });
  });
});
