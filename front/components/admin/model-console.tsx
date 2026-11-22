'use client';

import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Loader2,
  RotateCcw,
  Save,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  clearCapabilityModelsAction,
  probeCapabilityModelsAction,
  saveCapabilityModelsAction,
} from '@/app/[lang]/(app)/settings/models/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { StarBorder } from '@/components/ui/star-border';
import { Textarea } from '@/components/ui/textarea';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type {
  CapabilityModelConsole,
  ModelCatalogEntry,
  ModelConsoleResponse,
  ModelProbeResponse,
} from '@/lib/api/types';
import { cn } from '@/lib/utils';

export function ModelConsole({
  catalog,
  consoleData,
  copy,
  locale,
}: {
  catalog: ModelCatalogEntry[];
  consoleData: ModelConsoleResponse;
  copy: Dictionary['modelConsole'];
  locale: Locale;
}) {
  return (
    <div className="space-y-5">
      <Alert className="border-amber-500/35 bg-amber-500/8 text-foreground">
        <AlertTriangle className="text-amber-600" />
        <AlertTitle>{copy.riskTitle}</AlertTitle>
        <AlertDescription className="space-y-1">
          <p>{copy.scoreWarning}</p>
        </AlertDescription>
      </Alert>

      <div className="grid gap-5">
        {consoleData.capabilities.map((capability) => (
          <CapabilityCard
            catalog={catalog}
            capability={capability}
            copy={copy}
            key={capability.capability}
            locale={locale}
          />
        ))}
      </div>
    </div>
  );
}

function CapabilityCard({
  catalog,
  capability: initialCapability,
  copy,
  locale,
}: {
  catalog: ModelCatalogEntry[];
  capability: CapabilityModelConsole;
  copy: Dictionary['modelConsole'];
  locale: Locale;
}) {
  const [capability, setCapability] = useState(initialCapability);
  const [primary, setPrimary] = useState(initialCapability.primaryModelId);
  const [fallback, setFallback] = useState(initialCapability.fallbackModelId);
  const [notes, setNotes] = useState(initialCapability.notes ?? '');
  const [probe, setProbe] = useState<ModelProbeResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const applyCapability = (updated: CapabilityModelConsole) => {
    setCapability(updated);
    setPrimary(updated.primaryModelId);
    setFallback(updated.fallbackModelId);
    setNotes(updated.notes ?? '');
    setProbe(null);
  };

  const save = () => {
    startTransition(async () => {
      const result = await saveCapabilityModelsAction(
        locale,
        capability.capability,
        primary,
        fallback,
        notes,
      );
      setMessage(result.message);
      setError(result.status === 'error');
      if (result.capability) {
        applyCapability(result.capability);
        router.refresh();
      }
    });
  };

  const reset = () => {
    startTransition(async () => {
      const result = await clearCapabilityModelsAction(
        locale,
        capability.capability,
      );
      setMessage(result.message);
      setError(result.status === 'error');
      if (result.capability) {
        applyCapability(result.capability);
        router.refresh();
      }
    });
  };

  const runProbe = () => {
    startTransition(async () => {
      const result = await probeCapabilityModelsAction(
        locale,
        capability.capability,
      );
      setMessage(result.message);
      setError(result.status === 'error');
      setProbe(result.probe ?? null);
    });
  };

  return (
    <StarBorder className="bg-card text-card-foreground">
      <CardHeader className="border-b border-dashed bg-muted/20">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>{copy.capabilityLabels[capability.capability]}</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              {copy.capabilityDescriptions[capability.capability]}
            </CardDescription>
          </div>
          <Badge variant="secondary">{copy.sourceLabels[capability.source]}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <StarBorder className="grid gap-3 bg-muted/20 p-4 md:grid-cols-[1fr_1fr_auto]">
          <CurrentModel label={copy.primary} model={capability.primary} modelId={capability.primaryModelId} />
          <CurrentModel label={copy.fallback} model={capability.fallback} modelId={capability.fallbackModelId} />
          <div className="min-w-48">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {copy.estimate}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatCost(capability.costEstimate.estimatedCostUsd, locale)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {capability.costEstimate.sampleRuns === 0
                ? copy.noRuns
                : interpolate(copy.recentRuns, {
                    count: capability.costEstimate.sampleRuns,
                  })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {interpolate(copy.tokenMedian, {
                input: formatInteger(capability.costEstimate.medianInputTokens, locale),
                output: formatInteger(capability.costEstimate.medianOutputTokens, locale),
              })}
            </p>
          </div>
        </StarBorder>

        {capability.warnings.length > 0 && (
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="text-amber-600" />
            <AlertTitle>{copy.warnings}</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-4">
                {capability.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <CatalogPicker
            catalog={catalog}
            copy={copy}
            id={`${capability.capability}-primary`}
            label={copy.primary}
            locale={locale}
            onChange={setPrimary}
            value={primary}
          />
          <CatalogPicker
            catalog={catalog}
            copy={copy}
            id={`${capability.capability}-fallback`}
            label={copy.fallback}
            locale={locale}
            onChange={setFallback}
            value={fallback}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${capability.capability}-notes`}>{copy.notes}</Label>
          <Textarea
            id={`${capability.capability}-notes`}
            maxLength={2_000}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={copy.notesPlaceholder}
            rows={3}
            value={notes}
          />
        </div>

        {probe && <ProbeResult copy={copy} probe={probe} />}

        {message && (
          <p
            className={cn(
              'text-sm',
              error ? 'text-destructive' : 'text-muted-foreground',
            )}
            role="status"
          >
            {message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={save}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            {copy.actions.save}
          </Button>
          <Button disabled={pending} onClick={reset} variant="outline">
            <RotateCcw />
            {copy.actions.reset}
          </Button>
          <Button disabled={pending} onClick={runProbe} variant="outline">
            <FlaskConical />
            {copy.actions.probe}
          </Button>
        </div>
      </CardContent>
    </StarBorder>
  );
}

function CatalogPicker({
  catalog,
  copy,
  id,
  label,
  locale,
  onChange,
  value,
}: {
  catalog: ModelCatalogEntry[];
  copy: Dictionary['modelConsole'];
  id: string;
  label: string;
  locale: Locale;
  onChange: (value: string) => void;
  value: string;
}) {
  const options = useMemo<ComboboxOption[]>(
    () =>
      catalog.map((model) => ({
        value: model.id,
        label: model.displayName,
        description: `${model.id} · ${formatPrice(model, locale)} · ${formatContext(model.contextLength, locale)}`,
        group: model.family,
        keywords: model.providerIds,
      })),
    [catalog, locale],
  );
  const sunsetsAt = catalog.find((model) => model.id === value)?.sunsetsAt;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Combobox
        id={id}
        labels={{
          placeholder: copy.searchPlaceholder,
          search: copy.searchPlaceholder,
          empty: copy.noModels,
        }}
        onValueChange={onChange}
        options={options}
        value={value}
      />
      {sunsetsAt && (
        <p className="text-xs text-amber-700 dark:text-amber-400">{sunsetsAt}</p>
      )}
    </div>
  );
}

function CurrentModel({
  label,
  model,
  modelId,
}: {
  label: string;
  model: ModelCatalogEntry | null;
  modelId: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-sm font-semibold">{modelId}</p>
      {model && <p className="mt-1 text-xs text-muted-foreground">{model.family}</p>}
    </div>
  );
}

function ProbeResult({
  copy,
  probe,
}: {
  copy: Dictionary['modelConsole'];
  probe: ModelProbeResponse;
}) {
  return (
    <StarBorder className="p-4">
      <p className="text-sm font-semibold">{copy.probe.title}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ProbeAttempt copy={copy} label={copy.probe.primary} result={probe.primary} />
        <ProbeAttempt copy={copy} label={copy.probe.fallback} result={probe.fallback} />
      </div>
    </StarBorder>
  );
}

function ProbeAttempt({
  copy,
  label,
  result,
}: {
  copy: Dictionary['modelConsole'];
  label: string;
  result: ModelProbeResponse['primary'];
}) {
  return (
    <div className="flex gap-2 rounded-lg bg-muted/40 p-3 text-sm">
      {result.ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      )}
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {result.ok && result.servedModelId
            ? interpolate(copy.probe.servedBy, { model: result.servedModelId })
            : result.error ?? copy.probe.failed}
        </p>
        <p className="text-xs text-muted-foreground">
          {interpolate(copy.probe.latency, { latency: result.latencyMs })}
        </p>
      </div>
    </div>
  );
}

function formatPrice(model: ModelCatalogEntry, locale: Locale): string {
  const formatter = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
  return `$${formatter.format(model.inputPricePerMillion)} / $${formatter.format(model.outputPricePerMillion)}`;
}

function formatContext(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCost(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value);
}

function formatInteger(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US').format(value);
}

function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}
