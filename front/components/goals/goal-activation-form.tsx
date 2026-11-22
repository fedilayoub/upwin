'use client';

import { INITIAL_FORM_ACTION_STATE } from '@/lib/form-action-state';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { activateGoalAction } from '@/app/[lang]/(app)/actions';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';

export function GoalActivationForm({
  copy,
  goalId,
  locale,
}: {
  copy: Dictionary['goals'];
  goalId: string;
  locale: Locale;
}) {
  const [state, action, pending] = useActionState(
    activateGoalAction.bind(null, locale, goalId),
    INITIAL_FORM_ACTION_STATE,
  );

  useEffect(() => {
    if (state.status === 'idle' || !state.message) return;
    if (state.status === 'success') toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={action}>
      <Button
        disabled={pending}
        size="sm"
        type="submit"
        variant="outline"
      >
        {pending ? copy.switchingGoal : copy.switchGoal}
      </Button>
    </form>
  );
}
