import {
  Injectable,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export const CV_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const PDF_CONTENT_TYPE = 'application/pdf';
export const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface CvUpload {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

@Injectable()
export class CvTextService {
  async extract(upload: CvUpload): Promise<string> {
    if (upload.buffer.byteLength > CV_MAX_FILE_BYTES) throw cvTooLarge();

    let text: string;
    if (upload.mimetype === PDF_CONTENT_TYPE) {
      if (!hasPdfMagic(upload.buffer))
        throw invalidCv('The uploaded file is not a PDF.');
      text = await extractPdfText(upload.buffer);
    } else if (upload.mimetype === DOCX_CONTENT_TYPE) {
      if (!hasDocxMagic(upload.buffer)) {
        throw invalidCv('The uploaded file is not a valid DOCX document.');
      }
      text = await extractDocxText(upload.buffer);
    } else {
      throw invalidCv('Upload a PDF or DOCX CV.');
    }

    const normalized = normalizeExtractedText(text);
    if (normalized.length === 0) {
      throw new UnprocessableEntityException({
        code: 'CV_TEXT_NOT_FOUND',
        message:
          'No readable text layer was found. Upload a text-based CV or enter your details manually.',
      });
    }

    return normalized;
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    // result.text adds page markers. Per-page text reflects the actual text
    // layer, so an image-only/scanned PDF remains empty here.
    return result.pages.map((page) => page.text).join('\n');
  } catch (error: unknown) {
    throw invalidCv('The PDF could not be read.', error);
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error: unknown) {
    throw invalidCv('The DOCX document could not be read.', error);
  }
}

function hasPdfMagic(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).equals(Buffer.from('%PDF-', 'ascii'));
}

function hasDocxMagic(buffer: Buffer): boolean {
  const zipMagic = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  return (
    buffer.subarray(0, 4).equals(zipMagic) &&
    buffer.includes(Buffer.from('[Content_Types].xml', 'utf8')) &&
    buffer.includes(Buffer.from('word/document.xml', 'utf8'))
  );
}

function normalizeExtractedText(value: string): string {
  return value
    .replaceAll('\u0000', '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function invalidCv(
  message: string,
  cause?: unknown,
): UnprocessableEntityException {
  return new UnprocessableEntityException(
    { code: 'CV_INVALID', message },
    cause === undefined ? undefined : { cause },
  );
}

function cvTooLarge(): PayloadTooLargeException {
  return new PayloadTooLargeException({
    code: 'CV_TOO_LARGE',
    message: 'The CV must be 5 MB or smaller.',
  });
}
