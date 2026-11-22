'use client';

import {
  AlertTriangle,
  FolderGit2,
  Loader2,
  type LucideIcon,
  Palette,
  Plus,
  Target,
  Trash2,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import { useActionState, useId, useMemo, useRef, useState } from 'react';
import { saveManualContextAction } from '@/app/[lang]/(app)/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect, type MultiSelectLabels } from '@/components/ui/multi-select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { StarBorder } from '@/components/ui/star-border';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { ExperienceRole, FreelancerContext, PortfolioProject } from '@/lib/api';
import { INITIAL_FORM_ACTION_STATE } from '@/lib/form-action-state';

type ManualCopy = Dictionary['onboarding']['manual'];

const YEARS_CEILING = 40;
const YEARS_STEP = 0.5;
const DEFAULT_YEARS = 5;
const RATE_CEILING = 250;
const RATE_STEP = 5;
const DEFAULT_RATE = 60;

export function ManualContextForm({
  context,
  copy,
  editing = false,
  locale,
}: {
  context: FreelancerContext | null;
  copy: Dictionary['onboarding'];
  editing?: boolean;
  locale: Locale;
}) {
  const mode = context ? 'update' : 'create';
  const [state, action, pending] = useActionState(
    saveManualContextAction.bind(null, locale, mode),
    INITIAL_FORM_ACTION_STATE,
  );
  const manual = copy.manual;
  const fieldId = useId();

  const chipLabels: MultiSelectLabels = useMemo(
    () => ({
      add: manual.chips.add,
      search: manual.chips.search,
      empty: manual.chips.empty,
      limit: manual.chips.limit,
      create: (value) => manual.chips.create.replace('{value}', value),
      remove: (value) => manual.chips.remove.replace('{value}', value),
    }),
    [manual.chips],
  );

  return (
    <form action={action} className="space-y-5">
      {context?.confirmedAt ? (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertDescription>{manual.resetTrustWarning}</AlertDescription>
        </Alert>
      ) : null}

      <FormSection
        description={manual.sections.experienceDescription}
        icon={Trophy}
        optionalLabel={manual.optional}
        title={manual.sections.experience}
      >
        <YearsField
          copy={manual}
          error={fieldError(state.fieldErrors?.experienceYears, copy)}
          years={context?.experience.years ?? null}
        />

        <Field
          error={fieldError(state.fieldErrors?.skills, copy)}
          id={`${fieldId}-skills`}
          label={manual.fields.skills}
        >
          <MultiSelect
            defaultValue={context?.skills}
            id={`${fieldId}-skills`}
            invalid={Boolean(state.fieldErrors?.skills)}
            labels={chipLabels}
            name="skills"
            suggestions={manual.suggestions.skills}
          />
        </Field>

        <Separator />

        <RoleRows
          copy={manual}
          error={fieldError(state.fieldErrors?.roles, copy)}
          roles={context?.experience.roles ?? []}
        />
      </FormSection>

      <FormSection
        description={manual.sections.portfolioDescription}
        icon={FolderGit2}
        optionalLabel={manual.optional}
        title={manual.sections.portfolio}
      >
        <ProjectRows
          chipLabels={chipLabels}
          copy={manual}
          error={fieldError(state.fieldErrors?.portfolio, copy)}
          projects={context?.portfolio ?? []}
        />
      </FormSection>

      <FormSection
        description={manual.sections.positioningDescription}
        icon={Target}
        optionalLabel={manual.optional}
        title={manual.sections.positioning}
      >
        <TextFieldWithSuggestions
          defaultValue={context?.positioning.targetRole ?? ''}
          error={fieldError(state.fieldErrors?.targetRole, copy)}
          id={`${fieldId}-targetRole`}
          label={manual.fields.targetRole}
          name="targetRole"
          placeholder={manual.fields.targetRolePlaceholder}
          suggestions={manual.suggestions.targetRole}
        />

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            error={fieldError(state.fieldErrors?.targetClients, copy)}
            id={`${fieldId}-targetClients`}
            label={manual.fields.targetClients}
          >
            <MultiSelect
              defaultValue={context?.positioning.targetClients}
              id={`${fieldId}-targetClients`}
              invalid={Boolean(state.fieldErrors?.targetClients)}
              labels={chipLabels}
              name="targetClients"
              suggestions={manual.suggestions.targetClients}
            />
          </Field>
          <Field
            error={fieldError(state.fieldErrors?.targetIndustries, copy)}
            id={`${fieldId}-targetIndustries`}
            label={manual.fields.targetIndustries}
          >
            <MultiSelect
              defaultValue={context?.positioning.targetIndustries}
              id={`${fieldId}-targetIndustries`}
              invalid={Boolean(state.fieldErrors?.targetIndustries)}
              labels={chipLabels}
              name="targetIndustries"
              suggestions={manual.suggestions.targetIndustries}
            />
          </Field>
        </div>

        <RateField
          copy={manual}
          error={fieldError(state.fieldErrors?.targetRate, copy)}
          locale={locale}
          rate={context?.positioning.targetRate ?? null}
        />
      </FormSection>

      <FormSection
        description={manual.sections.preferencesDescription}
        icon={Palette}
        optionalLabel={manual.optional}
        title={manual.sections.preferences}
      >
        <TextFieldWithSuggestions
          defaultValue={context?.preferences.tone ?? ''}
          error={fieldError(state.fieldErrors?.tone, copy)}
          id={`${fieldId}-tone`}
          label={manual.fields.tone}
          name="tone"
          placeholder={manual.fields.tonePlaceholder}
          suggestions={manual.suggestions.tone}
        />

        <Field
          error={fieldError(state.fieldErrors?.services, copy)}
          id={`${fieldId}-services`}
          label={manual.fields.services}
        >
          <MultiSelect
            defaultValue={context?.preferences.services}
            id={`${fieldId}-services`}
            invalid={Boolean(state.fieldErrors?.services)}
            labels={chipLabels}
            name="services"
            suggestions={manual.suggestions.services}
          />
        </Field>
      </FormSection>

      {state.message || state.fieldErrors?.form ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>{state.message ?? copy.validation.checkFields}</AlertTitle>
          {state.fieldErrors?.form ? (
            <AlertDescription aria-live="polite">
              {fieldError(state.fieldErrors.form, copy)}
            </AlertDescription>
          ) : null}
        </Alert>
      ) : null}

      {/* Sticky so the save button stays reachable in a form this long. */}
      <StarBorder className="sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center gap-3 bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <Button disabled={pending} type="submit">
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? manual.saving : editing ? manual.saveEdits : manual.saveAndReview}
        </Button>
        {editing ? (
          <Button asChild variant="outline">
            <Link href={`/${locale}/context/review`}>{manual.cancel}</Link>
          </Button>
        ) : null}
        <p className="text-xs leading-5 text-muted-foreground">{manual.atLeastOne}</p>
      </StarBorder>
    </form>
  );
}

/**
 * Years and rate are optional, so a bare slider would silently claim a value the
 * freelancer never gave. The switch keeps "not specified" expressible, and the
 * hidden input only posts once it is on.
 */
function YearsField({
  copy,
  error,
  years,
}: {
  copy: ManualCopy;
  error?: string;
  years: number | null;
}) {
  const [enabled, setEnabled] = useState(years !== null);
  const [value, setValue] = useState(years ?? DEFAULT_YEARS);
  const switchId = useId();
  const ceiling = Math.max(YEARS_CEILING, value);

  return (
    <StarBorder className="bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-4">
        <Label className="font-normal" htmlFor={switchId}>
          {copy.fields.experienceYearsEnabled}
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
          <input name="experienceYears" type="hidden" value={value} />
          <p className="mt-4 text-sm font-medium tabular-nums">
            {value} {copy.fields.yearsUnit}
          </p>
          <Slider
            aria-label={copy.fields.experienceYears}
            className="mt-3 cursor-pointer"
            max={ceiling}
            min={0}
            onValueChange={([next]) => setValue(next ?? 0)}
            step={YEARS_STEP}
            value={[value]}
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>0</span>
            <span>
              {ceiling} {copy.fields.yearsUnit}
            </span>
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          {copy.fields.experienceYearsOff}
        </p>
      )}

      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
    </StarBorder>
  );
}

function RateField({
  copy,
  error,
  locale,
  rate,
}: {
  copy: ManualCopy;
  error?: string;
  locale: Locale;
  rate: number | null;
}) {
  const [enabled, setEnabled] = useState(rate !== null);
  const [value, setValue] = useState(rate ?? DEFAULT_RATE);
  const switchId = useId();
  const ceiling = Math.max(RATE_CEILING, roundUpToStep(value));
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
          <input name="targetRate" type="hidden" value={value} />
          <p className="mt-4 text-sm font-medium tabular-nums">
            {formatter.format(value)}
          </p>
          <Slider
            aria-label={copy.fields.targetRate}
            className="mt-3 cursor-pointer"
            max={ceiling}
            min={0}
            onValueChange={([next]) => setValue(next ?? 0)}
            step={RATE_STEP}
            value={[value]}
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{formatter.format(0)}</span>
            <span>{formatter.format(ceiling)}</span>
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{copy.fields.targetRateOff}</p>
      )}

      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
    </StarBorder>
  );
}

/**
 * Each row posts its own field per column; rows are matched by position on the
 * server, so nothing has to be squeezed into a delimited line any more.
 */
function RoleRows({
  copy,
  error,
  roles,
}: {
  copy: ManualCopy;
  error?: string;
  roles: ExperienceRole[];
}) {
  const { add, keys, remove } = useRowKeys(roles.length);

  return (
    <RowGroup
      addLabel={copy.rows.addRole}
      emptyLabel={copy.rows.noRoles}
      error={error}
      label={copy.fields.roles}
      onAdd={add}
      rowCount={keys.length}
    >
      {keys.map((key, index) => (
        <RowCard
          index={index}
          key={key}
          label={copy.rows.roleLabel.replace('{index}', String(index + 1))}
          onRemove={() => remove(key)}
          removeLabel={copy.rows.removeRole}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <RowField id={`${key}-title`} label={copy.fields.roleTitle}>
              <Input
                defaultValue={roles[index]?.title ?? ''}
                id={`${key}-title`}
                name="roleTitle"
                placeholder={copy.fields.roleTitlePlaceholder}
              />
            </RowField>
            <RowField id={`${key}-company`} label={copy.fields.roleCompany}>
              <Input
                defaultValue={roles[index]?.company ?? ''}
                id={`${key}-company`}
                name="roleCompany"
                placeholder={copy.fields.roleCompanyPlaceholder}
              />
            </RowField>
          </div>
          <RowField id={`${key}-period`} label={copy.fields.rolePeriod}>
            <Input
              className="max-w-56"
              defaultValue={roles[index]?.period ?? ''}
              id={`${key}-period`}
              name="rolePeriod"
              placeholder={copy.fields.rolePeriodPlaceholder}
            />
          </RowField>
          <RowField id={`${key}-description`} label={copy.fields.roleDescription}>
            <Textarea
              defaultValue={roles[index]?.description ?? ''}
              id={`${key}-description`}
              name="roleDescription"
              placeholder={copy.fields.roleDescriptionPlaceholder}
            />
          </RowField>
        </RowCard>
      ))}
    </RowGroup>
  );
}

function ProjectRows({
  chipLabels,
  copy,
  error,
  projects,
}: {
  chipLabels: MultiSelectLabels;
  copy: ManualCopy;
  error?: string;
  projects: PortfolioProject[];
}) {
  const { add, keys, remove } = useRowKeys(projects.length);

  return (
    <RowGroup
      addLabel={copy.rows.addProject}
      emptyLabel={copy.rows.noProjects}
      error={error}
      label={copy.fields.portfolio}
      onAdd={add}
      rowCount={keys.length}
    >
      {keys.map((key, index) => (
        <RowCard
          index={index}
          key={key}
          label={copy.rows.projectLabel.replace('{index}', String(index + 1))}
          onRemove={() => remove(key)}
          removeLabel={copy.rows.removeProject}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <RowField id={`${key}-title`} label={copy.fields.projectTitle}>
              <Input
                defaultValue={projects[index]?.title ?? ''}
                id={`${key}-title`}
                name="projectTitle"
                placeholder={copy.fields.projectTitlePlaceholder}
              />
            </RowField>
            <RowField id={`${key}-url`} label={copy.fields.projectUrl}>
              <Input
                defaultValue={projects[index]?.url ?? ''}
                id={`${key}-url`}
                inputMode="url"
                name="projectUrl"
                placeholder={copy.fields.projectUrlPlaceholder}
              />
            </RowField>
          </div>
          <RowField id={`${key}-description`} label={copy.fields.projectDescription}>
            <Textarea
              defaultValue={projects[index]?.description ?? ''}
              id={`${key}-description`}
              name="projectDescription"
              placeholder={copy.fields.projectDescriptionPlaceholder}
            />
          </RowField>
          <RowField id={`${key}-skills`} label={copy.fields.projectSkills}>
            <MultiSelect
              defaultValue={projects[index]?.skills}
              id={`${key}-skills`}
              labels={chipLabels}
              name={`projectSkills.${index}`}
              suggestions={copy.suggestions.skills}
            />
          </RowField>
        </RowCard>
      ))}
    </RowGroup>
  );
}

function useRowKeys(initialCount: number) {
  const nextKey = useRef(initialCount);
  const prefix = useId();
  const [keys, setKeys] = useState<string[]>(() =>
    Array.from({ length: initialCount }, (_, index) => `${prefix}-${index}`),
  );

  return {
    add: () => {
      setKeys((current) => [...current, `${prefix}-${nextKey.current++}`]);
    },
    keys,
    remove: (key: string) => {
      setKeys((current) => current.filter((item) => item !== key));
    },
  };
}

function RowGroup({
  addLabel,
  children,
  emptyLabel,
  error,
  label,
  onAdd,
  rowCount,
}: {
  addLabel: string;
  children: React.ReactNode;
  emptyLabel: string;
  error?: string;
  label: string;
  onAdd: () => void;
  rowCount: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <Button className="cursor-pointer" onClick={onAdd} size="sm" type="button" variant="outline">
          <Plus />
          {addLabel}
        </Button>
      </div>

      {rowCount === 0 ? (
        <p className="rounded-md border border-dashed border-border/70 px-4 py-6 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function RowCard({
  children,
  index,
  label,
  onRemove,
  removeLabel,
}: {
  children: React.ReactNode;
  index: number;
  label: string;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <StarBorder className="bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Button
          aria-label={removeLabel}
          className="cursor-pointer text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </div>
      <div className="space-y-3" data-row-index={index}>
        {children}
      </div>
    </StarBorder>
  );
}

function RowField({
  children,
  id,
  label,
}: {
  children: React.ReactNode;
  id: string;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-normal text-muted-foreground" htmlFor={id}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function TextFieldWithSuggestions({
  defaultValue,
  error,
  id,
  label,
  name,
  placeholder,
  suggestions,
}: {
  defaultValue: string;
  error?: string;
  id: string;
  label: string;
  name: string;
  placeholder: string;
  suggestions: readonly string[];
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <Field error={error} id={id} label={label}>
      <Input
        aria-invalid={Boolean(error)}
        id={id}
        name={name}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {suggestions
          .filter((suggestion) => suggestion !== value)
          .slice(0, 5)
          .map((suggestion) => (
            <button
              className="border-border/80 text-muted-foreground hover:border-[var(--dashboard-accent)]/40 hover:bg-[var(--dashboard-accent-soft)] hover:text-[var(--dashboard-accent)] focus-visible:ring-ring/50 cursor-pointer rounded-md border px-2 py-0.5 text-xs outline-none transition-colors focus-visible:ring-2"
              key={suggestion}
              onClick={() => setValue(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
          ))}
      </div>
    </Field>
  );
}

function FormSection({
  children,
  description,
  icon: Icon,
  optionalLabel,
  title,
}: {
  children: React.ReactNode;
  description: string;
  icon: LucideIcon;
  optionalLabel: string;
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
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-[-0.015em]">{title}</h2>
            <Badge className="text-[11px] font-normal" variant="outline">
              {optionalLabel}
            </Badge>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </StarBorder>
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

function fieldError(
  code: string | undefined,
  copy: Dictionary['onboarding'],
): string | undefined {
  if (!code || !(code in copy.validation)) return undefined;
  return copy.validation[code as keyof typeof copy.validation];
}

function roundUpToStep(value: number): number {
  return Math.ceil(Math.max(value, 0) / RATE_STEP) * RATE_STEP;
}
