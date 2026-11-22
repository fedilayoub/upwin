'use client';

import { ChevronDown } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { Dictionary } from '@/i18n/types';
import {
  PROPOSAL_OUTCOME_STATUSES,
  type ProposalOutcomeStatus,
} from '@/lib/api';
import type { FormActionState } from '@/lib/form-action-state';

/** Saves on change: no submit button. Reverts and toasts if the save fails. */
export function ProposalStatusSelect({
  ariaLabel,
  initialStatus,
  messages,
  outcomeStatuses,
  saveStatus,
}: {
  ariaLabel: string;
  initialStatus: ProposalOutcomeStatus;
  /** Fallbacks for when the action returns no message of its own. */
  messages: { saved: string; genericError: string };
  outcomeStatuses: Dictionary['dashboard']['outcomeStatuses'];
  saveStatus: (formData: FormData) => Promise<FormActionState>;
}) {
  const [status, setStatus] = useState<ProposalOutcomeStatus>(initialStatus);
  const [pending, startTransition] = useTransition();

  function handleChange(next: ProposalOutcomeStatus) {
    const previous = status;
    setStatus(next);

    const formData = new FormData();
    formData.set('status', next);

    startTransition(async () => {
      const result = await saveStatus(formData);
      if (result.status === 'error') {
        setStatus(previous);
        toast.error(result.message ?? messages.genericError);
        return;
      }
      toast.success(result.message ?? messages.saved);
    });
  }

  return (
    <div className="relative min-w-0">
      <select
        aria-busy={pending}
        aria-label={ariaLabel}
        className="h-8 w-full min-w-0 appearance-none rounded-lg border bg-background pr-8 pl-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--dashboard-accent)]/35 disabled:opacity-60"
        disabled={pending}
        name="status"
        onChange={(event) =>
          handleChange(event.target.value as ProposalOutcomeStatus)
        }
        value={status}
      >
        {PROPOSAL_OUTCOME_STATUSES.map((option) => (
          <option key={option} value={option}>
            {outcomeStatuses[option]}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
