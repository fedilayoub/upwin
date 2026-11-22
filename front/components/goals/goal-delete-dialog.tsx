'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteGoalAction } from '@/app/[lang]/(app)/actions';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { INITIAL_FORM_ACTION_STATE } from '@/lib/form-action-state';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { GoalConfiguration } from '@/lib/api';

export function GoalDeleteDialog({
  copy,
  goal,
  locale,
  onOpenChange,
  open: controlledOpen,
  showTrigger = true,
}: {
  copy: Dictionary['goals'];
  goal: GoalConfiguration;
  locale: Locale;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  showTrigger?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const open = controlledOpen ?? uncontrolledOpen;

  function setOpen(nextOpen: boolean) {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  /**
   * The row unmounts as soon as the revalidated page arrives, so the result is
   * awaited here rather than through `useActionState` — an effect on the
   * disappearing component is not a reliable place to raise the toast.
   */
  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteGoalAction(
        locale,
        goal.id,
        INITIAL_FORM_ACTION_STATE,
      );

      if (result.status === 'success') {
        setOpen(false);
        toast.success(result.message ?? copy.messages.deleted);
        return;
      }
      toast.error(result.message ?? copy.messages.deleteError);
    });
  }

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      {showTrigger ? (
        <AlertDialogTrigger asChild>
          <Button
            aria-label={`${copy.deleteGoal}: ${goal.targetRole}`}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive size-8 cursor-pointer"
            size="icon"
            variant="ghost"
          >
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
      ) : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {copy.deleteDescription.replace('{role}', goal.targetRole)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {goal.isActive ? (
          <p className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
            {copy.deleteActiveNote}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel
            className="cursor-pointer disabled:cursor-not-allowed"
            disabled={pending}
          >
            {copy.cancel}
          </AlertDialogCancel>
          <Button
            className="cursor-pointer disabled:cursor-not-allowed"
            disabled={pending}
            onClick={confirmDelete}
            type="button"
            variant="destructive"
          >
            {pending ? copy.deletingGoal : copy.deleteConfirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
