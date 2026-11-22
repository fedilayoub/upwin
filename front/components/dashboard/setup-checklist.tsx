import { Check, ListChecks, Lock, PlugZap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StarBorder } from '@/components/ui/star-border';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import {
  buildSetupSteps,
  type SetupProgress,
  type SetupStep,
  type SetupStepId,
} from '@/lib/setup-checklist';
import { cn } from '@/lib/utils';

type SetupCopy = Dictionary['dashboard']['setup'];

/**
 * The first-run path on the dashboard: add details, create a goal, then open
 * the extension. The extension step shows no install button until the first
 * two are done, so a new user is not sent to an analyzer that would turn them
 * back for a missing goal or unconfirmed details.
 */
export function SetupChecklist({
  copy,
  locale,
  progress,
  tourTarget = false,
}: {
  copy: SetupCopy;
  locale: Locale;
  progress: SetupProgress;
  /** True when this card stands in for the analytics the tour's last dashboard step points at. */
  tourTarget?: boolean;
}) {
  const steps = buildSetupSteps(progress);
  const doneCount = steps.filter((step) => step.state === 'done').length;
  const unconfirmed = progress.context === 'unconfirmed';

  const content: Record<SetupStepId, { title: string; description: string }> = {
    skills: {
      title: copy.steps.skills.title,
      description: unconfirmed
        ? copy.steps.skills.confirmDescription
        : copy.steps.skills.description,
    },
    goal: copy.steps.goal,
    extension: copy.steps.extension,
  };

  return (
    <StarBorder
      as="section"
      className="bg-card text-card-foreground"
      data-setup-checklist
      data-tour={tourTarget ? 'analysis' : undefined}
    >
      <header className="flex flex-col gap-3 border-b border-dashed px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <StarBorder
            aria-hidden="true"
            as="span"
            className="grid size-9 shrink-0 place-items-center bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]"
          >
            <ListChecks className="size-[18px]" />
          </StarBorder>
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-[-0.015em]">{copy.title}</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {copy.description}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground sm:pt-1">
          {copy.progress
            .replace('{done}', String(doneCount))
            .replace('{total}', String(steps.length))}
        </p>
      </header>

      <ol className="grid lg:grid-cols-3">
        {steps.map((step, index) => (
          <li
            aria-current={step.state === 'current' ? 'step' : undefined}
            className={cn(
              'flex flex-col gap-3 border-b border-dashed px-4 py-4 last:border-b-0 sm:px-5 lg:border-b-0 lg:border-r lg:last:border-r-0',
              step.state === 'current' ? 'bg-[var(--dashboard-accent-soft)]' : undefined,
            )}
            data-setup-step={step.id}
            data-setup-step-state={step.state}
            key={step.id}
          >
            <div className="flex items-start gap-3">
              <StepMarker number={index + 1} state={step.state} />
              <div className="min-w-0 space-y-1">
                <h3
                  className={cn(
                    'text-sm font-medium leading-6',
                    step.state === 'locked' ? 'text-muted-foreground' : undefined,
                  )}
                >
                  {content[step.id].title}
                </h3>
                <p className="text-xs leading-5 text-muted-foreground">
                  {content[step.id].description}
                </p>
              </div>
            </div>
            <div className="mt-auto pl-9">
              <StepAction copy={copy} locale={locale} step={step} unconfirmed={unconfirmed} />
            </div>
          </li>
        ))}
      </ol>
    </StarBorder>
  );
}

function StepMarker({ number, state }: { number: number; state: SetupStep['state'] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums',
        state === 'done' || state === 'current'
          ? 'bg-[var(--dashboard-accent)] text-[var(--dashboard-accent-foreground)]'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {state === 'done' ? (
        <Check className="size-3.5" strokeWidth={3} />
      ) : state === 'locked' ? (
        <Lock className="size-3" />
      ) : (
        number
      )}
    </span>
  );
}

function StepAction({
  copy,
  locale,
  step,
  unconfirmed,
}: {
  copy: SetupCopy;
  locale: Locale;
  step: SetupStep;
  unconfirmed: boolean;
}) {
  if (step.state === 'done') {
    return <p className="text-xs font-medium text-[var(--dashboard-accent)]">{copy.done}</p>;
  }
  if (step.state === 'locked') {
    return <p className="text-xs text-muted-foreground">{copy.locked}</p>;
  }

  const variant = step.state === 'current' ? 'default' : 'outline';

  if (step.id === 'extension') {
    return (
      <Button asChild size="sm" variant={variant}>
        <Link href={`/${locale}/settings/connection`}>
          <PlugZap />
          {copy.steps.extension.action}
        </Link>
      </Button>
    );
  }

  const href =
    step.id === 'goal'
      ? `/${locale}/goals`
      : unconfirmed
        ? `/${locale}/context/review`
        : `/${locale}/context`;
  const label =
    step.id === 'goal'
      ? copy.steps.goal.action
      : unconfirmed
        ? copy.steps.skills.confirmAction
        : copy.steps.skills.action;

  return (
    <Button asChild size="sm" variant={variant}>
      <Link href={href}>{label}</Link>
    </Button>
  );
}
