'use client';

import { AlertTriangle, CheckCircle2, Palette, ShieldCheck, UserPen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
import { saveProposalPreferencesAction } from '@/app/[lang]/(app)/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Hardware } from '@/components/ui/hardware/hardware';
import { ModeDial } from '@/components/ui/hardware/mode-dial';
import { SlideSwitch } from '@/components/ui/hardware/slide-switch';
import { WheelSelect } from '@/components/ui/hardware/wheel-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StarBorder } from '@/components/ui/star-border';
import { Textarea } from '@/components/ui/textarea';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import {
  ANSWER_LENGTHS,
  OUTPUT_LANGUAGES,
  PROPOSAL_LENGTHS,
  PROPOSAL_TONES,
  type ProposalPreferences,
} from '@/lib/api';
import {
  INITIAL_FORM_ACTION_STATE,
  type FormActionState,
} from '@/lib/form-action-state';
import { cn } from '@/lib/utils';

export function ProposalPreferencesForm({
  copy,
  locale,
  preferences,
}: {
  copy: Dictionary['proposals'];
  locale: Locale;
  preferences: ProposalPreferences;
}) {
  const [state, formAction, pending] = useActionState(
    saveProposalPreferencesAction.bind(null, locale),
    INITIAL_FORM_ACTION_STATE,
  );
  const [dirty, setDirty] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-[-0.015em]">
          {copy.formTitle}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {copy.formDescription}
        </p>
      </div>

      <ProposalPreferencesFields
        copy={copy}
        fieldErrors={state.fieldErrors}
        locale={locale}
        onDirtyChange={setDirty}
        preferences={preferences}
      />

      <ProposalPreferencesFormStatus state={state} />

      {/* Sticky so the save button stays reachable while the sections scroll. */}
      <StarBorder className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <Button
          disabled={pending || !dirty}
          type="submit"
        >
          {pending ? copy.saving : copy.save}
        </Button>
        <Badge className="gap-1.5 px-2.5 py-1" variant={dirty ? 'secondary' : 'outline'}>
          {dirty ? (
            <AlertTriangle className="size-3.5" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
          {dirty ? copy.unsavedChanges : copy.allSaved}
        </Badge>
      </StarBorder>
    </form>
  );
}

export function ProposalPreferencesFields({
  copy,
  fieldErrors,
  locale,
  onDirtyChange,
  preferences,
}: {
  copy: Dictionary['proposals'];
  fieldErrors?: Record<string, string>;
  /** Orders the languages alphabetically in the interface's language. */
  locale: Locale;
  onDirtyChange?: (dirty: boolean) => void;
  preferences: ProposalPreferences;
}) {
  const [values, setValues] = useState(() => toFormValues(preferences));

  // `preferences` is refetched after a successful save (the action revalidates
  // this path), so comparing against the prop resets the flag on its own.
  const dirty = !sameValues(values, toFormValues(preferences));

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const update = <Key extends keyof FormValues>(key: Key, value: FormValues[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5">
      <FormSection
        description={copy.sections.writingDescription}
        icon={Palette}
        title={copy.sections.writingTitle}
      >
        {/* One panel of hardware controls. The skin is scoped to this root; its
            finish for each theme is in components/ui/hardware/app.css.

            The layout follows the panel's own width, not the viewport's: the
            sidebar takes a share of the screen that a media query cannot see.
            - Wide: a faceplate in three zones. The dial sits in the middle,
              the two length switches stack on its left and the language on
              its right, each side centered on the dial.
            - Medium: the dial on the right, the other three stacked beside it.
            - Narrow: one column, in source order.
            A placement is one `grid-row` value because `row-span-*` is that
            shorthand too, and would reset a `row-start-*` beside it. */}
        <div className="@container">
          <Hardware
            className={cn(
              'grid gap-x-10 gap-y-7 rounded-xl p-5 @3xl:p-7',
              '@3xl:grid-cols-[minmax(0,1fr)_324px]',
              '@5xl:grid-cols-[minmax(0,1fr)_324px_minmax(0,1fr)]',
            )}
          >
            <Field
              className="@3xl:col-start-1 @5xl:self-end"
              description={copy.proposalLengths[values.proposalLength].description}
              error={fieldError(fieldErrors?.proposalLength, copy)}
              id="proposalLength"
              label={copy.fields.proposalLength}
            >
              <SlideSwitch
                aria-describedby={describedBy('proposalLength', fieldErrors)}
                aria-labelledby="proposalLength-label"
                name="proposalLength"
                onValueChange={(value) => update('proposalLength', value)}
                options={PROPOSAL_LENGTHS.map((length) => ({
                  label: copy.proposalLengths[length].label,
                  value: length,
                }))}
                value={values.proposalLength}
              />
            </Field>

            <Field
              className="@3xl:col-start-1 @5xl:self-start"
              description={copy.answerLengths[values.answerLength].description}
              error={fieldError(fieldErrors?.answerLength, copy)}
              id="answerLength"
              label={copy.fields.answerLength}
            >
              <SlideSwitch
                aria-describedby={describedBy('answerLength', fieldErrors)}
                aria-labelledby="answerLength-label"
                name="answerLength"
                onValueChange={(value) => update('answerLength', value)}
                options={ANSWER_LENGTHS.map((length) => ({
                  label: copy.answerLengths[length].label,
                  value: length,
                }))}
                value={values.answerLength}
              />
            </Field>

            <Field
              className="@3xl:col-start-2 @3xl:[grid-row:1/span_3] @3xl:self-center @3xl:text-center @5xl:[grid-row:1/span_2]"
              description={copy.fieldHelp.proposalTone}
              error={fieldError(fieldErrors?.proposalTone, copy)}
              id="proposalTone"
              label={copy.fields.proposalTone}
            >
              {/* A dial rather than a dropdown: four tones is few enough to keep
                  every one in view, and choosing takes one press, not two. */}
              <ModeDial
                aria-describedby={describedBy('proposalTone', fieldErrors)}
                aria-labelledby="proposalTone-label"
                name="proposalTone"
                onValueChange={(value) => update('proposalTone', value)}
                options={PROPOSAL_TONES.map((tone) => ({
                  label: copy.proposalTones[tone],
                  value: tone,
                }))}
                sweep={200}
                value={values.proposalTone}
              />
            </Field>

            {/* On the wide faceplate this mirrors the left zone: a block as wide
                as the control, set against the panel's right edge. */}
            <Field
              className="@3xl:col-start-1 @5xl:col-start-3 @5xl:[grid-row:1/span_2] @5xl:w-full @5xl:max-w-64 @5xl:self-center @5xl:justify-self-end"
              description={copy.fieldHelp.language}
              error={fieldError(fieldErrors?.language, copy)}
              id="language"
              label={copy.fields.language}
            >
              {/* A wheel rather than one key per language: it takes the same
                  room for seven languages as for two, and for more later. */}
              <WheelSelect
                aria-describedby={describedBy('language', fieldErrors)}
                aria-labelledby="language-label"
                className="max-w-64"
                name="language"
                onValueChange={(value) => update('language', value)}
                options={languageOptions(copy, locale)}
                value={values.language}
              />
            </Field>
          </Hardware>
        </div>
      </FormSection>

      <FormSection
        description={copy.sections.personalDescription}
        icon={UserPen}
        title={copy.sections.personalTitle}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            description={copy.fieldHelp.signOffName}
            error={fieldError(fieldErrors?.signOffName, copy)}
            id="signOffName"
            label={`${copy.fields.signOffName} · ${copy.fields.optional}`}
          >
            <Input
              aria-describedby={describedBy('signOffName', fieldErrors)}
              aria-invalid={Boolean(fieldErrors?.signOffName)}
              className="max-w-sm"
              id="signOffName"
              maxLength={120}
              name="signOffName"
              onChange={(event) => update('signOffName', event.currentTarget.value)}
              placeholder={copy.fields.signOffNamePlaceholder}
              value={values.signOffName}
            />
          </Field>

          <Field
            className="md:col-span-2"
            error={fieldError(fieldErrors?.customInstructions, copy)}
            id="customInstructions"
            label={`${copy.fields.customInstructions} · ${copy.fields.optional}`}
          >
            <Textarea
              aria-describedby={`${describedBy('customInstructions', fieldErrors)} customInstructions-boundary customInstructions-count`}
              aria-invalid={Boolean(fieldErrors?.customInstructions)}
              className="min-h-36 resize-y"
              id="customInstructions"
              maxLength={2_000}
              name="customInstructions"
              onChange={(event) =>
                update('customInstructions', event.currentTarget.value)
              }
              placeholder={copy.fields.customInstructionsPlaceholder}
              value={values.customInstructions}
            />
            <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
              <p className="leading-5" id="customInstructions-help">
                {copy.customInstructionsHelp}
              </p>
              <p
                aria-live="polite"
                className="shrink-0 tabular-nums"
                id="customInstructions-count"
              >
                {copy.fields.characterCount.replace(
                  '{count}',
                  String(values.customInstructions.length),
                )}
              </p>
            </div>
          </Field>
        </div>

        <Alert variant="accent">
          <ShieldCheck />
          <AlertTitle>{copy.sections.guardrailTitle}</AlertTitle>
          <AlertDescription id="customInstructions-boundary">
            {copy.factualBoundary}
          </AlertDescription>
        </Alert>
      </FormSection>
    </div>
  );
}

export function ProposalPreferencesFormStatus({
  state,
}: {
  state: FormActionState;
}) {
  if (!state.message) return null;
  const failed = state.status === 'error';

  return (
    <Alert
      aria-live="polite"
      role={failed ? 'alert' : 'status'}
      variant={failed ? 'destructive' : 'accent'}
    >
      {failed ? <AlertTriangle /> : <CheckCircle2 />}
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

function Field({
  children,
  className,
  description,
  error,
  id,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  description?: string;
  error?: string;
  id: string;
  label: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* `id` lets a radiogroup name itself from this label, which `htmlFor`
          cannot do — it can only point at one radio. */}
      <Label htmlFor={id} id={`${id}-label`}>
        {label}
      </Label>
      {children}
      {/* The description stays rendered alongside an error: it explains the
          field, the error only says what is wrong with this attempt.
          `data-hardware` lets the hardware skin recolor both inside a
          `<Hardware>` panel, whose plate is not the page's background; it
          does nothing anywhere else. */}
      {error ? (
        <p
          className="text-xs text-destructive"
          data-hardware="error"
          id={`${id}-error`}
        >
          {error}
        </p>
      ) : null}
      {description ? (
        <p
          className="text-xs leading-5 text-muted-foreground"
          data-hardware="help"
          id={`${id}-help`}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

function FormSection({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <StarBorder as="fieldset" className="bg-card p-5 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="mb-5 flex items-start gap-3">
        <StarBorder
          aria-hidden="true"
          as="span"
          className="grid size-9 shrink-0 place-items-center bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]"
        >
          <Icon className="size-[18px]" strokeWidth={2} />
        </StarBorder>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-base font-semibold tracking-[-0.015em]">{title}</h3>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </StarBorder>
  );
}

/**
 * The output languages, alphabetical by their label in the interface's
 * language. The collator is given the locale explicitly: the runtime's own
 * default can differ between the server render and the browser.
 */
function languageOptions(copy: Dictionary['proposals'], locale: Locale) {
  const collator = new Intl.Collator(locale);
  return OUTPUT_LANGUAGES.map((outputLanguage) => ({
    label: copy.languages[outputLanguage],
    value: outputLanguage,
  })).sort((left, right) => collator.compare(left.label, right.label));
}

interface FormValues {
  answerLength: ProposalPreferences['answerLength'];
  customInstructions: string;
  language: ProposalPreferences['language'];
  proposalLength: ProposalPreferences['proposalLength'];
  proposalTone: ProposalPreferences['proposalTone'];
  signOffName: string;
}

function toFormValues(preferences: ProposalPreferences): FormValues {
  return {
    answerLength: preferences.answerLength,
    customInstructions: preferences.customInstructions ?? '',
    language: preferences.language,
    proposalLength: preferences.proposalLength,
    proposalTone: preferences.proposalTone,
    signOffName: preferences.signOffName ?? '',
  };
}

function sameValues(left: FormValues, right: FormValues): boolean {
  return (
    left.answerLength === right.answerLength &&
    left.customInstructions === right.customInstructions &&
    left.language === right.language &&
    left.proposalLength === right.proposalLength &&
    left.proposalTone === right.proposalTone &&
    left.signOffName === right.signOffName
  );
}

/**
 * Points a control at its error as well as its description. Naming only
 * `{id}-help` left the error unannounced, since the error text carries a
 * different id and is the part a failed submit needs to convey.
 */
function describedBy(
  id: string,
  fieldErrors: Record<string, string> | undefined,
): string {
  return fieldErrors?.[id] ? `${id}-error ${id}-help` : `${id}-help`;
}

function fieldError(
  code: string | undefined,
  copy: Dictionary['proposals'],
): string | undefined {
  if (!code || !(code in copy.validation)) return undefined;
  return copy.validation[code as keyof typeof copy.validation];
}
