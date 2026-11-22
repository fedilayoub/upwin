import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

/**
 * Every response carries `X-Request-Id`, and every error log line names it.
 * A user report from the extension then leads to one server log line.
 *
 * An incoming id is honoured only when it looks like one we would mint
 * ourselves, so a caller cannot inject log-forging text through the header.
 */
export const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export function isRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
}

/** Typed structurally: Fastify passes an HTTP/1 or HTTP/2 request. */
export function genRequestId(request: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const incoming = request.headers[REQUEST_ID_HEADER];
  return isRequestId(incoming) ? incoming : randomUUID();
}

/** Adds the response header before any handler, guard, or error filter runs. */
export function registerRequestIdHeader(instance: FastifyInstance): void {
  instance.addHook('onRequest', (request, reply, done) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
    done();
  });
}
