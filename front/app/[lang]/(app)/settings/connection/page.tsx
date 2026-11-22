import { CircleCheck, CircleX, PlugZap } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { StarBorder } from '@/components/ui/star-border';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getConnectionStatus } from '@/lib/connection-status';

export default async function ConnectionPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [dictionary, status] = await Promise.all([
    getDictionary(lang),
    getConnectionStatus(),
  ]);
  const copy = dictionary.settings.connection;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-10 pt-2 sm:pt-4">
      <PageHeader description={copy.description} icon={PlugZap} title={copy.title} />

      <StarBorder as="section" aria-labelledby="connection-api" className="bg-card p-5 sm:p-6">
        <h2 className="text-base font-semibold" id="connection-api">{copy.api.title}</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">{copy.api.url}</dt>
          <dd><code className="break-all">{status.apiUrl}</code></dd>
          <dt className="text-muted-foreground">{copy.api.status}</dt>
          <dd>
            <span className="inline-flex items-center gap-1.5" data-api-status={status.reachable ? 'up' : 'down'}>
              {status.reachable ? (
                <CircleCheck aria-hidden="true" className="size-4 text-emerald-600" />
              ) : (
                <CircleX aria-hidden="true" className="size-4 text-destructive" />
              )}
              {status.reachable ? copy.api.reachable : copy.api.unreachable}
            </span>
            {status.reachable ? null : (
              <p className="mt-1 text-muted-foreground">{copy.api.unreachableHint}</p>
            )}
          </dd>
          <dt className="text-muted-foreground">{copy.api.token}</dt>
          <dd>{status.tokenConfigured ? copy.api.tokenSet : copy.api.tokenUnset}</dd>
          <dt className="text-muted-foreground">{copy.api.password}</dt>
          <dd>{status.passwordConfigured ? copy.api.passwordSet : copy.api.passwordUnset}</dd>
        </dl>
      </StarBorder>

      <StarBorder as="section" aria-labelledby="connection-ai" className="bg-card p-5 sm:p-6">
        <h2 className="text-base font-semibold" id="connection-ai">{copy.ai.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{copy.ai.description}</p>
        {status.models ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[12rem_1fr]" data-ai-models>
            {status.models.map((model) => (
              <div className="contents" key={model.capability}>
                <dt className="text-muted-foreground">
                  {dictionary.modelConsole.capabilityLabels[model.capability]}
                </dt>
                <dd>
                  <code className="break-all">{model.modelId}</code>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 text-sm">{copy.ai.unknown}</p>
        )}
        <Button asChild className="mt-4" size="sm" variant="outline">
          <Link href={`/${lang}/settings/models`}>{copy.ai.modelsLink}</Link>
        </Button>
      </StarBorder>

      <StarBorder as="section" aria-labelledby="connection-extension" className="bg-card p-5 sm:p-6">
        <h2 className="text-base font-semibold" id="connection-extension">{copy.extension.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{copy.extension.description}</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
          {copy.extension.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-4 text-sm">
          <span className="text-muted-foreground">{copy.extension.apiUrlLabel}: </span>
          <code className="break-all">{status.apiUrl}</code>
        </p>
      </StarBorder>
    </div>
  );
}
