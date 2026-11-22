import { resolveApiBaseUrl } from '@/features/connection/connection-store';

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

export type TokenProvider = (options?: {
  skipCache?: boolean;
}) => Promise<string | null>;

interface ApiClientOptions {
  /** A fixed URL, or a resolver read on every request (the stored connection). */
  baseUrl: string | (() => Promise<string>);
  extensionOrigin?: string;
  fetchImplementation?: typeof fetch;
}

interface AuthenticatedRequestOptions extends RequestInit {
  getToken: TokenProvider;
  operation: string;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly operation: string,
    readonly status?: number,
    readonly code?: string,
    /** The API's `X-Request-Id`: the key to the matching server log line. */
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

function readRequestId(response: Response): string | undefined {
  const value = response.headers.get('x-request-id');
  return value && REQUEST_ID_PATTERN.test(value) ? value : undefined;
}

export function getErrorCode(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }

  return typeof error === 'string' ? error : null;
}

export function getErrorStatus(error: unknown): number | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status;
  }

  return null;
}

export class ApiClient {
  private readonly baseUrl: string | (() => Promise<string>);
  private readonly extensionOrigin?: string;
  private readonly fetchImplementation: typeof fetch;

  constructor({
    baseUrl,
    extensionOrigin,
    fetchImplementation,
  }: ApiClientOptions) {
    this.baseUrl = baseUrl;
    this.extensionOrigin = extensionOrigin;
    // Chromium's native fetch requires the Window/global receiver. Keeping the
    // bare function and later calling it as a class member causes an
    // "Illegal invocation" error in extension pages.
    this.fetchImplementation =
      fetchImplementation ??
      ((input, init) => globalThis.fetch(input, init));
  }

  async request<T>(
    path: string,
    { getToken, operation, ...init }: AuthenticatedRequestOptions,
  ): Promise<T> {
    const baseUrl =
      typeof this.baseUrl === 'string' ? this.baseUrl : await this.baseUrl();
    const requestUrl = this.resolveRequestUrl(baseUrl, path, operation);
    // Null is normal: an API that only listens on this machine needs no token.
    const token = await getToken();
    const response = await this.send(requestUrl, token, init, operation);

    if (!response.ok) {
      throw await createResponseError(response, operation);
    }

    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
  }

  async mockRequest<T>(
    operation: string,
    responseFactory: () => T | Promise<T>,
    delayMs = 450,
  ): Promise<T> {
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, delayMs);
    });

    try {
      return await responseFactory();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Request failed';
      throw new ApiClientError(message, operation);
    }
  }

  private resolveRequestUrl(
    rawBaseUrl: string,
    path: string,
    operation: string,
  ): URL {
    try {
      const baseUrl = new URL(rawBaseUrl);
      const requestUrl = new URL(path, baseUrl);

      if (!path.startsWith('/') || requestUrl.origin !== baseUrl.origin) {
        throw new Error('Cross-origin API paths are not allowed.');
      }

      return requestUrl;
    } catch {
      throw new ApiClientError(
        'The API endpoint is not configured safely.',
        operation,
        undefined,
        'INVALID_API_ENDPOINT',
      );
    }
  }

  private async send(
    url: URL,
    token: string | null,
    init: RequestInit,
    operation: string,
  ): Promise<Response> {
    try {
      return await this.sendOnce(url, token, init);
    } catch (error: unknown) {
      // The request never got an HTTP answer: offline, DNS, CORS, a blocked
      // host permission. One code for all of them, kept apart from API errors.
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ApiClientError(
        'The upwin API could not be reached. Check that it is running and that the address in Settings is right.',
        operation,
        undefined,
        'NETWORK_ERROR',
      );
    }
  }

  private sendOnce(url: URL, token: string | null, init: RequestInit) {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    if (this.extensionOrigin) {
      headers.set('X-Upilot-Extension-Origin', this.extensionOrigin);
    }

    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    return this.fetchImplementation(url, {
      ...init,
      credentials: 'omit',
      headers,
    });
  }
}

async function createResponseError(
  response: Response,
  operation: string,
): Promise<ApiClientError> {
  let message = `Request failed with status ${response.status}.`;
  let code: string | undefined;

  try {
    const body = (await response.json()) as {
      error?: { code?: unknown; message?: unknown };
    };

    if (typeof body.error?.message === 'string') message = body.error.message;
    if (typeof body.error?.code === 'string') code = body.error.code;
  } catch {
    // Error responses are not required to contain JSON.
  }

  if (response.status === 401 && message === 'Request failed with status 401.') {
    message = 'The API rejected the token. Check the API token in Settings.';
  }
  if (response.status === 403 && message === 'Request failed with status 403.') {
    message = 'The API does not allow this extension. Add its origin to EXTENSION_ALLOWED_ORIGINS.';
  }

  return new ApiClientError(
    message,
    operation,
    response.status,
    code,
    readRequestId(response),
  );
}

export const apiClient = new ApiClient({
  baseUrl: resolveApiBaseUrl,
  extensionOrigin:
    typeof browser === 'undefined'
      ? undefined
      : `chrome-extension://${browser.runtime.id}`,
});
