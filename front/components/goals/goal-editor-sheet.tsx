'use client';

import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { GoalForm } from '@/components/goals/goal-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { GoalConfiguration } from '@/lib/api';

/**
 * The trigger is built here rather than accepted as a prop. `goals-table.tsx` is
 * a server component, and Radix's Slot silently renders `null` for an `asChild`
 * child that crossed the RSC boundary — the button disappears with every gate
 * still green.
 */
export function GoalEditorSheet({
  copy,
  goal,
  locale,
  onOpenChange,
  open: controlledOpen,
  showTrigger = true,
}: {
  copy: Dictionary['goals'];
  goal?: GoalConfiguration;
  locale: Locale;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  showTrigger?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;

  function setOpen(nextOpen: boolean) {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      {showTrigger ? (
        <SheetTrigger asChild>
          {goal ? (
            <Button
              aria-label={`${copy.editGoal}: ${goal.targetRole}`}
              className="cursor-pointer"
              size="sm"
              variant="ghost"
            >
              <Pencil />
              {copy.editGoal}
            </Button>
          ) : (
            <Button>
              <Plus />
              {copy.newGoal}
            </Button>
          )}
        </SheetTrigger>
      ) : null}
      <SheetContent className="w-[min(94vw,44rem)] gap-0 overflow-y-auto p-0 sm:max-w-[44rem]">
        <SheetHeader className="border-b border-border/70 px-6 py-5 pr-12 text-left">
          <SheetTitle className="text-lg tracking-[-0.015em]">
            {goal ? copy.editTitle : copy.createAnotherTitle}
          </SheetTitle>
          <SheetDescription className="max-w-xl leading-5">
            {goal ? copy.editDescription : copy.createDescription}
          </SheetDescription>
        </SheetHeader>
        <div className="p-6">
          <GoalForm
            copy={copy}
            goal={goal}
            locale={locale}
            onSuccess={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
