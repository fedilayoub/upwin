'use client';

import { Loader2, ShieldCheck } from 'lucide-react';
import { useActionState } from 'react';
import { confirmFreelancerContextAction } from '@/app/[lang]/(app)/actions';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { INITIAL_FORM_ACTION_STATE } from '@/lib/form-action-state';

export function ConfirmContextForm({
  canConfirm,
  copy,
  locale,
}: {
  canConfirm: boolean;
  copy: Dictionary['onboarding']['review'];
  locale: Locale;
}) {
  const [state, action, pending] = useActionState(
    confirmFreelancerContextAction.bind(null, locale),
    INITIAL_FORM_ACTION_STATE,
  );

  return (
    <form action={action} className="shrink-0 space-y-2 sm:text-right">
      <Button disabled={!canConfirm || pending} type="submit">
        {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        {pending ? copy.confirming : copy.confirm}
      </Button>
      {!canConfirm ? (
        <p className="text-xs font-medium text-destructive">{copy.cannotConfirm}</p>
      ) : null}
      {state.message ? (
        <p
          aria-live="polite"
          className={
            state.status === 'error'
              ? 'text-sm text-destructive'
              : 'text-sm font-medium text-[var(--dashboard-accent)]'
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
