import { useCallback, useState } from 'react';
import { reportError } from '@/features/diagnostics/error-log';
import type { ErrorRecord } from '@/features/diagnostics/errors';
import { getErrorCode, type RequestStatus } from '@/services/api';

interface AsyncState<TResult> {
  data: TResult | null;
  error: string | null;
  errorCode: string | null;
  /** The diagnostics record of the last failure: its ref is shown to the user. */
  failure: ErrorRecord | null;
  status: RequestStatus;
}

export interface AsyncActionOptions {
  /** A dotted name for reports, e.g. `profile.analyze`. Defaults to the error's own. */
  operation?: string;
}

const IDLE = {
  data: null,
  error: null,
  errorCode: null,
  failure: null,
  status: 'idle',
} as const;

export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: AsyncActionOptions = {},
) {
  const [state, setState] = useState<AsyncState<TResult>>(IDLE);
  const { operation } = options;

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setState((current) => ({
        ...current,
        error: null,
        errorCode: null,
        failure: null,
        status: 'loading',
      }));

      try {
        const data = await action(...args);
        setState({
          data,
          error: null,
          errorCode: null,
          failure: null,
          status: 'success',
        });
        return data;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Something went wrong';
        const errorCode = getErrorCode(error);
        // Every screen's failure gets a ref and lands in the diagnostics log.
        const failure = reportError({ error, operation });
        setState({ data: null, error: message, errorCode, failure, status: 'error' });
        return null;
      }
    },
    [action, operation],
  );

  const reset = useCallback(() => {
    setState(IDLE);
  }, []);

  return { ...state, execute, reset };
}
