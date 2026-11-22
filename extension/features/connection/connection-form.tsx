import { useState, type FormEvent } from 'react';
import { Check, Copy, LoaderCircle, PlugZap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import type { TranslationKey } from '@/features/i18n/dictionaries/en';
import { useConnection, type ConnectionStatus } from './connection-context';

const STATUS_MESSAGE: Partial<Record<ConnectionStatus, TranslationKey>> = {
  unreachable: 'connection.error.unreachable',
  unauthorized: 'connection.error.unauthorized',
  forbidden: 'connection.error.forbidden',
  invalid: 'connection.error.invalid',
};

/**
 * The API address, optional token and web app address. Used on first run and
 * in Settings. Saving re-checks the connection at once.
 */
export function ConnectionForm() {
  const { connection, extensionOrigin, save, status } = useConnection();
  const { t } = useI18n();
  const [apiUrl, setApiUrl] = useState(connection.apiUrl);
  const [token, setToken] = useState(connection.token ?? '');
  const [appUrl, setAppUrl] = useState(connection.appUrl);
  const [copied, setCopied] = useState(false);
  const checking = status === 'checking';
  const message = STATUS_MESSAGE[status];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save({ apiUrl, appUrl, token: token || null });
  }

  async function copyOrigin() {
    await navigator.clipboard.writeText(extensionOrigin).catch(() => undefined);
    setCopied(true);
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
      <Field
        help={t('connection.apiUrlHelp')}
        id="connection-api-url"
        label={t('connection.apiUrl')}
        onChange={setApiUrl}
        placeholder="http://localhost:3002"
        type="url"
        value={apiUrl}
      />
      <Field
        help={t('connection.tokenHelp')}
        id="connection-token"
        label={t('connection.token')}
        onChange={setToken}
        type="password"
        value={token}
      />
      <Field
        help={t('connection.appUrlHelp')}
        id="connection-app-url"
        label={t('connection.appUrl')}
        onChange={setAppUrl}
        placeholder="http://localhost:3000"
        type="url"
        value={appUrl}
      />

      {message ? (
        <div
          className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-relaxed"
          data-connection-status={status}
          role="alert"
        >
          <p>{t(message, { url: connection.apiUrl })}</p>
          {status === 'forbidden' && extensionOrigin ? (
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono">
                {extensionOrigin}
              </code>
              <Button
                aria-label={t('connection.copyOrigin')}
                onClick={() => void copyOrigin()}
                size="icon"
                type="button"
                variant="outline"
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button className="w-full" disabled={checking} type="submit">
        {checking ? <LoaderCircle className="animate-spin" /> : <PlugZap />}
        {checking ? t('connection.checking') : t('connection.save')}
      </Button>
    </form>
  );
}

function Field({
  help,
  id,
  label,
  onChange,
  placeholder,
  type,
  value,
}: {
  help: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type: 'url' | 'password';
  value: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium" htmlFor={id}>
        {label}
      </label>
      <input
        autoComplete="off"
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        type={type}
        value={value}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">{help}</p>
    </div>
  );
}
