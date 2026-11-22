import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { z } from 'zod';
import {
  apiClient,
  getErrorCode,
  getErrorStatus,
  type TokenProvider,
} from '@/services/api';
import {
  connectionTokenProvider,
  defaultConnection,
  readConnection,
  saveConnection,
  type Connection,
} from './connection-store';

/**
 * `connected` is the only state the app screens render in. Every other state
 * shows the connection screen with the reason, so a freelancer always knows
 * what to fix.
 */
export type ConnectionStatus =
  | 'checking'
  | 'connected'
  | 'unreachable'
  | 'unauthorized'
  | 'forbidden'
  | 'invalid';

interface ConnectionContextValue {
  status: ConnectionStatus;
  isConnected: boolean;
  connection: Connection;
  /** Passed to every service call. Resolves the stored token, or null. */
  getToken: TokenProvider;
  /** `chrome-extension://<id>`: what the API's EXTENSION_ALLOWED_ORIGINS must list. */
  extensionOrigin: string;
  save: (next: Connection) => Promise<ConnectionStatus>;
  recheck: () => Promise<ConnectionStatus>;
}

// GET /me returns the single local user.
const meResponseSchema = z.object({ id: z.string().uuid() });

/** Asks the API who we are. Any answer but a valid user explains what is wrong. */
export async function checkConnection(): Promise<ConnectionStatus> {
  try {
    const response = await apiClient.request<unknown>('/me', {
      getToken: connectionTokenProvider,
      method: 'GET',
      operation: 'GET /me',
    });
    return meResponseSchema.safeParse(response).success ? 'connected' : 'invalid';
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    if (status === 401) return 'unauthorized';
    if (status === 403) return 'forbidden';
    if (getErrorCode(error) === 'NETWORK_ERROR') return 'unreachable';
    return 'invalid';
  }
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [connection, setConnection] = useState<Connection>(defaultConnection);

  const recheck = useCallback(async () => {
    setStatus('checking');
    setConnection(await readConnection());
    const next = await checkConnection();
    setStatus(next);
    return next;
  }, []);

  const save = useCallback(async (input: Connection) => {
    setStatus('checking');
    setConnection(await saveConnection(input));
    const next = await checkConnection();
    setStatus(next);
    return next;
  }, []);

  // First open tries the stored connection, or the defaults: with the API on
  // localhost:3002 the extension connects without any setup.
  useEffect(() => {
    void recheck();
  }, [recheck]);

  const value = useMemo<ConnectionContextValue>(
    () => ({
      status,
      isConnected: status === 'connected',
      connection,
      getToken: connectionTokenProvider,
      extensionOrigin:
        typeof browser === 'undefined'
          ? ''
          : `chrome-extension://${browser.runtime.id}`,
      save,
      recheck,
    }),
    [connection, recheck, save, status],
  );

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}

/**
 * The web app address for "open in the web app" links. Falls back to the
 * default outside a provider, so presentational components stay renderable
 * on their own.
 */
export function useAppUrl(): string {
  return useContext(ConnectionContext)?.connection.appUrl ?? defaultConnection.appUrl;
}

export function useConnection(): ConnectionContextValue {
  const value = useContext(ConnectionContext);
  if (!value) {
    throw new Error('useConnection must be used inside ConnectionProvider.');
  }
  return value;
}
