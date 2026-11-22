import { HttpException } from '@nestjs/common';

const errors = {
  VIDEO_NOT_CONFIGURED: [
    503,
    'Video recording is not configured on this server.',
  ],
  VIDEO_NOT_FOUND: [404, 'Video not found.'],
  VIDEO_NOT_UPLOADING: [409, 'This video is no longer uploading.'],
  VIDEO_UPLOAD_INVALID: [
    422,
    'The uploaded parts do not match. Upload the parts again.',
  ],
  VIDEO_TOO_LARGE: [413, 'The upload exceeds the recording limits.'],
  VIDEO_STORAGE_ERROR: [502, 'Video storage is temporarily unavailable.'],
  VALIDATION_FAILED: [400, 'The video request is invalid.'],
} as const;
export function videoError(code: keyof typeof errors): HttpException {
  const [status, message] = errors[code];
  // Do not attach SDK errors as causes: the global filter logs cause chains.
  return new HttpException({ code, message }, status);
}
