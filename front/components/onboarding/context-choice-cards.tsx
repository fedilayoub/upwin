import { Check, FileText, PenLine } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StarBorder } from '@/components/ui/star-border';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';

/**
 * The two ways in. Both cards say what the route actually costs the user —
 * a minute and a PDF, or typing — so the choice is made on effort rather than
 * on which button looks more prominent.
 */
export function ContextChoiceCards({
  copy,
  locale,
}: {
  copy: Dictionary['onboarding'];
  locale: Locale;
}) {
  const choices = [
    {
      action: copy.uploadChoiceAction,
      description: copy.uploadChoiceDescription,
      href: `/${locale}/context/cv`,
      icon: FileText,
      key: 'cv',
      points: copy.uploadChoicePoints,
      recommended: true,
      title: copy.uploadChoiceTitle,
      variant: 'default' as const,
    },
    {
      action: copy.manualChoiceAction,
      description: copy.manualChoiceDescription,
      href: `/${locale}/context/manual`,
      icon: PenLine,
      key: 'manual',
      points: copy.manualChoicePoints,
      recommended: false,
      title: copy.manualChoiceTitle,
      variant: 'outline' as const,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {choices.map((choice) => (
        <StarBorder
          as="article"
          className="flex flex-col gap-4 bg-card p-5 transition-colors hover:border-[var(--dashboard-accent)]/35 sm:p-6"
          key={choice.key}
        >
          <div className="flex items-start justify-between gap-3">
            <StarBorder
              aria-hidden="true"
              as="span"
              className="grid size-10 place-items-center bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]"
            >
              <choice.icon className="size-5" strokeWidth={2} />
            </StarBorder>
            {choice.recommended ? (
              <Badge
                className="border-[var(--dashboard-accent)]/30 bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]"
                variant="outline"
              >
                {copy.recommended}
              </Badge>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-semibold tracking-[-0.015em]">
              {choice.title}
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {choice.description}
            </p>
          </div>

          <ul className="space-y-2">
            {[choice.points.one, choice.points.two, choice.points.three].map(
              (point) => (
                <li className="flex items-start gap-2 text-sm leading-6" key={point}>
                  <Check
                    aria-hidden="true"
                    className="mt-1 size-3.5 shrink-0 text-[var(--dashboard-accent)]"
                    strokeWidth={3}
                  />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ),
            )}
          </ul>

          <Button asChild className="mt-auto w-full" variant={choice.variant}>
            <Link href={choice.href}>{choice.action}</Link>
          </Button>
        </StarBorder>
      ))}
    </div>
  );
}
