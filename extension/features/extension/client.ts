import {
  isExtensionResponse,
  type ExtensionErrorCode,
  type ExtensionRequestDataMap,
  type ExtensionRequestType,
  type RequestOf,
} from './protocol';

/**
 * A failure the worker or a content script reported. It keeps the protocol's
 * code so a screen can tell "wrong page" apart from a failed read.
 */
export class ExtensionRequestError extends Error {
  readonly code: ExtensionErrorCode;

  constructor(code: ExtensionErrorCode, message: string) {
    super(message);
    this.name = 'ExtensionRequestError';
    this.code = code;
  }
}

/**
 * Sends a request to the background worker and narrows the reply to the payload
 * that request type promises.
 *
 * The body reaches `sendMessage` before its first await, so a caller may invoke
 * this straight from a click handler without losing the user gesture — which
 * `sidePanel.open()` depends on.
 */
export async function sendExtensionRequest<T extends ExtensionRequestType>(
  request: RequestOf<T>,
  isData: (value: unknown) => value is ExtensionRequestDataMap[T],
): Promise<ExtensionRequestDataMap[T]> {
  const response: unknown = await browser.runtime.sendMessage(request);

  if (!isExtensionResponse(response)) {
    throw new Error('The extension runtime returned an invalid response.');
  }

  if (!response.ok) {
    throw new ExtensionRequestError(response.error.code, response.error.message);
  }

  if (!isData(response.data)) {
    throw new Error('The extension runtime returned an invalid response.');
  }

  return response.data;
}
