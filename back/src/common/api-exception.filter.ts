import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import '../auth/authenticated-request';

interface ErrorEnvelope {
  error: { code: string; message: string };
}

/**
 * The extension's ApiClient reads `body.error.message` and `body.error.code`
 * (see ../../extension/services/api.ts). Any other shape degrades to generic
 * client-side error text, so every failure is normalised here.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    const request = http.getRequest<FastifyRequest | undefined>();
    const { status, body } = this.toEnvelope(exception);
    const context = describeRequest(request, status, body.error.code);

    // Compared as a number: `status` comes from HttpException, which types it as
    // `number`, so comparing against the enum member is an unsafe enum comparison.
    if (status >= 500) {
      this.logger.error(`${context}\n${describeFailure(exception)}`);
    } else {
      // Every 4xx is logged with its hidden cause (a token's verification
      // reason, for instance), so a client report can be matched to the reason.
      const cause = describeCause(exception);
      this.logger.warn(cause ? `${context} cause="${cause}"` : context);
    }

    void reply.status(status).send(body);
  }

  private toEnvelope(exception: unknown): { status: number; body: ErrorEnvelope } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      return {
        status,
        body: {
          error: {
            code: extractCode(response) ?? httpStatusCode(status),
            message: extractMessage(response) ?? exception.message,
          },
        },
      };
    }

    // Internal details never reach the client.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } },
    };
  }
}

/**
 * One line, key=value, without the query string: queries can carry share
 * tokens, and nothing here may print a credential.
 */
export function describeRequest(
  request: FastifyRequest | undefined,
  status: number,
  code: string,
): string {
  if (!request) return `status=${status} code=${code}`;

  const route = request.routeOptions.url ?? request.url.split('?')[0] ?? '';
  const parts = [
    `${request.method} ${route}`,
    `status=${status}`,
    `code=${code}`,
    `requestId=${request.id}`,
  ];
  if (request.currentUser) parts.push(`userId=${request.currentUser.id}`);

  return parts.join(' ');
}

/** The first cause behind a 4xx, as `reason: message`, on one line. */
export function describeCause(exception: unknown): string | null {
  const cause = exception instanceof Error ? exception.cause : undefined;
  if (cause === undefined || cause === null) return null;

  const reason =
    typeof cause === 'object' &&
    'reason' in cause &&
    typeof cause.reason === 'string'
      ? cause.reason
      : null;
  const message =
    cause instanceof Error ? cause.message : stringify(cause);
  const line = reason ? `${reason}: ${message}` : message;

  return line.replace(/\s+/g, ' ').replaceAll('"', "'").slice(0, 300);
}

function extractCode(response: string | object): string | undefined {
  if (typeof response !== 'object') return undefined;
  const code = (response as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function extractMessage(response: string | object): string | undefined {
  if (typeof response === 'string') return response;

  const message = (response as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) {
    const parts = message.filter((entry): entry is string => typeof entry === 'string');
    if (parts.length > 0) return parts.join(' ');
  }

  return undefined;
}

function httpStatusCode(status: number): string {
  return HttpStatus[status] ?? 'HTTP_ERROR';
}

/**
 * A 5xx is wrapped before it reaches here — `aiEvaluationFailed` puts the real
 * fault in `cause`. Logging only the wrapper's stack prints
 * "BadGatewayException: The AI evaluation could not be completed." and nothing
 * about why, which is unusable. Walk the chain instead.
 */
function describeFailure(exception: unknown): string {
  const parts: string[] = [];
  let current: unknown = exception;

  for (let depth = 0; current !== undefined && current !== null && depth < 5; depth += 1) {
    parts.push(
      current instanceof Error
        ? (current.stack ?? `${current.name}: ${current.message}`)
        : stringify(current),
    );
    current = current instanceof Error ? current.cause : undefined;
  }

  return parts.join('\nCaused by: ');
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? 'unknown error';
  } catch {
    return 'unserialisable error';
  }
}
