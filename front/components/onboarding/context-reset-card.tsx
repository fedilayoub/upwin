'use client';

import { RotateCcw, Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';
import { deleteFreelancerContextAction } from '@/app/[lang]/(app)/actions';
import { Button } from '@/components/ui/button';
import { StarBorder } from '@/components/ui/star-border';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import {
  CONTEXT_DELETE_CONFIRMATION_FIELD,
  CONTEXT_DELETE_CONFIRMATION_VALUE,
} from '@/lib/context-reset';
import { INITIAL_FORM_ACTION_STATE } from '@/lib/form-action-state';

export function ContextResetCard({
  copy,
  locale,
}: {
  copy: Dictionary['onboarding']['review'];
  locale: Locale;
}) {
  const [state, action, pending] = useActionState(
    deleteFreelancerContextAction.bind(null, locale),
    INITIAL_FORM_ACTION_STATE,
  );

  return (
    <StarBorder
      as="section"
      className="sticky bottom-3 z-20 flex flex-col gap-3 bg-background/80 p-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 sm:flex-row sm:items-center sm:justify-between sm:px-5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <StarBorder
          aria-hidden="true"
          as="span"
          className="grid size-9 shrink-0 place-items-center bg-muted text-muted-foreground"
        >
          <RotateCcw className="size-[18px]" strokeWidth={2} />
        </StarBorder>
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-base font-semibold tracking-[-0.015em]">
            {copy.startOverTitle}
          </h2>
          <p className="hidden max-w-2xl text-sm leading-6 text-muted-foreground md:block">
            {copy.startOverDescription}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={`/${locale}/context/cv`}>
            <Upload />
            {copy.uploadDifferentCv}
          </Link>
        </Button>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              <Trash2 />
              {copy.deleteAndStartScratch}
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{copy.deleteConfirmTitle}</SheetTitle>
              <SheetDescription>{copy.deleteConfirmDescription}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 text-sm">
              <p className="font-medium text-destructive">{copy.deleteContextLost}</p>
              <p className="text-muted-foreground">{copy.deleteContextPreserved}</p>
            </div>
            <form action={action} className="mt-auto space-y-4">
              <input
                name={CONTEXT_DELETE_CONFIRMATION_FIELD}
                type="hidden"
                value={CONTEXT_DELETE_CONFIRMATION_VALUE}
              />
              {state.message ? (
                <p aria-live="polite" className="px-4 text-sm text-destructive">
                  {state.message}
                </p>
              ) : null}
              <SheetFooter>
                <SheetClose asChild>
                  <Button disabled={pending} type="button" variant="outline">
                    {copy.cancelDelete}
                  </Button>
                </SheetClose>
                <Button disabled={pending} type="submit" variant="destructive">
                  {pending ? copy.deleting : copy.deleteConfirmAction}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    </StarBorder>
  );
}
