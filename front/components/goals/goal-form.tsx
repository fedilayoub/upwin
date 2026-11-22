'use client';

import { INITIAL_FORM_ACTION_STATE } from '@/lib/form-action-state';
import { useActionState, useEffect, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  createGoalAction,
  updateGoalAction,
} from '@/app/[lang]/(app)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect, type MultiSelectLabels } from '@/components/ui/multi-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { StarBorder } from '@/components/ui/star-border';
import { Switch } from '@/components/ui/switch';
import type { GoalConfiguration } from '@/lib/api';
import { GOAL_OBJECTIVES } from '@/lib/api';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';

const RATE_STEP = 5;
const RATE_CEILING = 250;
const DEFAULT_RATE: [number, number] = [40, 90];

export function GoalForm({
  copy,
  goal,
  locale,
  onSuccess,
}: {
  copy: Dictionary['goals'];
  goal?: GoalConfiguration;
  locale: Locale;
  onSuccess?: () => void;
}) {
  const action = goal
    ? updateGoalAction.bind(null, locale, goal.id)
    : createGoalAction.bind(null, locale);
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_FORM_ACTION_STATE,
  );
  const [targetRole, setTargetRole] = useState(goal?.targetRole ?? '');
  const fieldId = useId();

  useEffect(() => {
    if (state.status === 'idle' || !state.message) return;
    if (state.status === 'success') {
      toast.success(state.message);
      onSuccess?.();
      return;
    }
    toast.error(state.message);
  }, [onSuccess, state]);

  const chipLabels: MultiSelectLabels = useMemo(
    () => ({
      add: copy.chips.add,
      search: copy.chips.search,
      empty: copy.chips.empty,
      limit: copy.chips.limit,
      create: (value) => copy.chips.create.replace('{value}', value),
      remove: (value) => copy.chips.remove.replace('{value}', value),
    }),
    [copy.chips],
  );

  return (
    <form action={formAction} className="space-y-7">
      <FormSection
        description={copy.formSections.focusDescription}
        title={copy.formSections.focus}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            error={fieldError(state.fieldErrors?.objective, copy)}
            id={`${fieldId}-objective`}
            label={copy.fields.objective}
          >
            <Select
              defaultValue={goal?.objective ?? 'first-client'}
              name="objective"
            >
              <SelectTrigger
                aria-invalid={Boolean(state.fieldErrors?.objective)}
                className="w-full cursor-pointer"
                id={`${fieldId}-objective`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_OBJECTIVES.map((objective) => (
                  <SelectItem
                    className="cursor-pointer"
                    key={objective}
                    value={objective}
                  >
                    {copy.objectives[objective]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            error={fieldError(state.fieldErrors?.targetRole, copy)}
            id={`${fieldId}-targetRole`}
            label={copy.fields.targetRole}
          >
            <Input
              aria-invalid={Boolean(state.fieldErrors?.targetRole)}
              id={`${fieldId}-targetRole`}
              maxLength={500}
              name="targetRole"
              onChange={(event) => setTargetRole(event.target.value)}
              placeholder={copy.fields.targetRolePlaceholder}
              required
              value={targetRole}
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {copy.suggestions.targetRole
                .filter((suggestion) => suggestion !== targetRole)
                .slice(0, 5)
                .map((suggestion) => (
                  <button
                    className="border-border/80 text-muted-foreground hover:border-[var(--dashboard-accent)]/40 hover:bg-[var(--dashboard-accent-soft)] hover:text-[var(--dashboard-accent)] focus-visible:ring-ring/50 cursor-pointer rounded-md border px-2 py-0.5 text-xs outline-none transition-colors focus-visible:ring-2"
                    key={suggestion}
                    onClick={() => setTargetRole(suggestion)}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
            </div>
          </Field>
        </div>
      </FormSection>

      <Separator />

      <FormSection
        description={copy.formSections.workDescription}
        title={copy.formSections.work}
      >
        <div className="space-y-5">
          <Field
            error={fieldError(state.fieldErrors?.targetProjectTypes, copy)}
            id={`${fieldId}-targetProjectTypes`}
            label={copy.fields.targetProjectTypes}
          >
            <MultiSelect
              defaultValue={goal?.targetProjectTypes}
              id={`${fieldId}-targetProjectTypes`}
              invalid={Boolean(state.fieldErrors?.targetProjectTypes)}
              labels={chipLabels}
              name="targetProjectTypes"
              suggestions={copy.suggestions.targetProjectTypes}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              error={fieldError(state.fieldErrors?.targetClients, copy)}
              id={`${fieldId}-targetClients`}
              label={`${copy.fields.targetClients} · ${copy.fields.optional}`}
            >
              <MultiSelect
                defaultValue={goal?.targetClients}
                id={`${fieldId}-targetClients`}
                invalid={Boolean(state.fieldErrors?.targetClients)}
                labels={chipLabels}
                name="targetClients"
                suggestions={copy.suggestions.targetClients}
              />
            </Field>

            <Field
              error={fieldError(state.fieldErrors?.preferredSkills, copy)}
              id={`${fieldId}-preferredSkills`}
              label={`${copy.fields.preferredSkills} · ${copy.fields.optional}`}
            >
              <MultiSelect
                defaultValue={goal?.preferredSkills}
                id={`${fieldId}-preferredSkills`}
                invalid={Boolean(state.fieldErrors?.preferredSkills)}
                labels={chipLabels}
                name="preferredSkills"
                suggestions={copy.suggestions.preferredSkills}
              />
            </Field>
          </div>
        </div>
      </FormSection>

      <Separator />

      <FormSection
        description={copy.formSections.rateDescription}
        title={copy.formSections.rate}
      >
        <RateRangeField
          copy={copy}
          error={
            fieldError(state.fieldErrors?.targetRateMin, copy) ??
            fieldError(state.fieldErrors?.targetRateMax, copy)
          }
          locale={locale}
          rate={goal?.targetRate ?? null}
        />
      </FormSection>

      {/* Sticky so the save button stays reachable while the drawer scrolls. */}
      <div className="sticky bottom-0 z-10 -mx-6 -mb-6 flex justify-end border-t border-border/70 bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button
          disabled={pending}
          type="submit"
        >
          {pending
            ? goal
              ? copy.savingGoal
              : copy.creatingGoal
            : goal
              ? copy.saveGoal
              : copy.createGoal}
        </Button>
      </div>
    </form>
  );
}

function RateRangeField({
  copy,
  error,
  locale,
  rate,
}: {
  copy: Dictionary['goals'];
  error?: string;
  locale: Locale;
  rate: GoalConfiguration['targetRate'];
}) {
  const initial = initialRateRange(rate);
  const [enabled, setEnabled] = useState(rate !== null);
  const [range, setRange] = useState<[number, number]>(initial);
  const switchId = useId();
  const ceiling = Math.max(RATE_CEILING, roundUpToStep(initial[1]));
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        currency: 'USD',
        maximumFractionDigits: 0,
        style: 'currency',
      }),
    [locale],
  );

  return (
    <StarBorder className="bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-4">
        <Label className="font-normal" htmlFor={switchId}>
          {copy.fields.targetRateEnabled}
        </Label>
        <Switch
          checked={enabled}
          className="data-[state=checked]:bg-[var(--dashboard-accent)]"
          id={switchId}
          onCheckedChange={setEnabled}
        />
      </div>

      {enabled ? (
        <>
          <input name="targetRateMin" type="hidden" value={range[0]} />
          <input name="targetRateMax" type="hidden" value={range[1]} />
          <p className="mt-4 text-sm font-medium tabular-nums">
            {formatter.format(range[0])} – {formatter.format(range[1])}
          </p>
          <Slider
            aria-label={`${copy.fields.targetRateMin} / ${copy.fields.targetRateMax}`}
            className="mt-3 cursor-pointer"
            max={ceiling}
            min={0}
            minStepsBetweenThumbs={1}
            onValueChange={([min, max]) =>
              setRange([min ?? 0, max ?? ceiling])
            }
            step={RATE_STEP}
            value={range}
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{formatter.format(0)}</span>
            <span>{formatter.format(ceiling)}</span>
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          {copy.fields.targetRateOff}
        </p>
      )}

      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
    </StarBorder>
  );
}

function FormSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-[-0.01em]">{title}</h3>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  children,
  error,
  id,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  id: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function initialRateRange(
  rate: GoalConfiguration['targetRate'],
): [number, number] {
  if (!rate) return DEFAULT_RATE;
  const min = roundUpToStep(rate.min ?? 0);
  const max = roundUpToStep(rate.max ?? Math.max(min + 50, 100));
  return [min, Math.max(max, min + RATE_STEP)];
}

function roundUpToStep(value: number): number {
  return Math.ceil(Math.max(value, 0) / RATE_STEP) * RATE_STEP;
}

function fieldError(
  code: string | undefined,
  copy: Dictionary['goals'],
): string | undefined {
  if (!code || !(code in copy.validation)) return undefined;
  return copy.validation[code as keyof typeof copy.validation];
}
