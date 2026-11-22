import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

/**
 * The client always sees the same generic 401. `cause` is server-side only: the
 * exception filter logs it, and it never reaches the response body.
 */
export function unauthenticated(cause?: unknown): UnauthorizedException {
  return new UnauthorizedException(
    {
      code: 'UNAUTHENTICATED',
      message: 'Authentication required.',
    },
    cause === undefined ? undefined : { cause },
  );
}

export function forbiddenExtensionOrigin(): ForbiddenException {
  return new ForbiddenException({
    code: 'FORBIDDEN',
    message: 'This extension origin is not allowed.',
  });
}

export function forbiddenHost(): ForbiddenException {
  return new ForbiddenException({
    code: 'FORBIDDEN',
    message:
      'Without API_TOKEN, only requests addressed to localhost are served. Set API_TOKEN to reach the API by another name.',
  });
}
