'use client';

import { CheckCircle2, Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { startTransition, useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { activateGoalAction } from '@/app/[lang]/(app)/actions';
import { GoalDeleteDialog } from '@/components/goals/goal-delete-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { GoalConfiguration } from '@/lib/api';
import { INITIAL_FORM_ACTION_STATE } from '@/lib/form-action-state';

export function GoalActionsMenu({
  copy,
  goal,
  locale,
  onEdit,
}: {
  copy: Dictionary['goals'];
  goal: GoalConfiguration;
  locale: Locale;
  onEdit: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activationState, activate, activationPending] = useActionState(
    activateGoalAction.bind(null, locale, goal.id),
    INITIAL_FORM_ACTION_STATE,
  );

  useEffect(() => {
    if (activationState.status === 'idle' || !activationState.message) return;
    if (activationState.status === 'success') toast.success(activationState.message);
    else toast.error(activationState.message);
  }, [activationState]);

  return (
    <>
      {/*
        Non-modal on purpose: every item here opens a Sheet or Dialog. A modal
        menu locks the body with `pointer-events: none`, and when the sheet it
        opened closes after a save, that lock is left behind — the next click
        on any trigger in the table does nothing until a reload.
      */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`${copy.columns.actions}: ${goal.targetRole}`}
            className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
            size="icon"
            variant="ghost"
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={onEdit}
          >
            <Pencil />
            {copy.editGoal}
          </DropdownMenuItem>
          {goal.isActive ? null : (
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={activationPending}
              onSelect={() => startTransition(() => activate())}
            >
              <CheckCircle2 />
              {activationPending ? copy.switchingGoal : copy.switchGoal}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setDeleteOpen(true)}
            variant="destructive"
          >
            <Trash2 />
            {copy.deleteGoal}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <GoalDeleteDialog
        copy={copy}
        goal={goal}
        locale={locale}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        showTrigger={false}
      />
    </>
  );
}
