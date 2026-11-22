'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/i18n/types';
import { unlockAction, type UnlockState } from './actions';

export function UnlockForm({
  copy,
  locale,
  next,
}: {
  copy: Dictionary['unlock'];
  locale: string;
  next: string;
}) {
  const [state, action, pending] = useActionState<UnlockState, FormData>(
    unlockAction.bind(null, locale),
    { wrong: false },
  );

  return (
    <form action={action} className="space-y-4">
      <input name="next" type="hidden" value={next} />
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="unlock-password">
          {copy.password}
        </label>
        <input
          autoComplete="current-password"
          autoFocus
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          id="unlock-password"
          name="password"
          required
          type="password"
        />
      </div>
      {state.wrong ? (
        <p className="text-sm text-destructive" role="alert">
          {copy.wrong}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} type="submit">
        {copy.submit}
      </Button>
    </form>
  );
}
