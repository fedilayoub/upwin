import { GoalIcon } from '@/components/goals/goal-icon';
import { notFound } from 'next/navigation';
import { GoalsTable } from '@/components/goals/goals-table';
import { StarBorder } from '@/components/ui/star-border';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale } from '@/i18n/config';
import { getBackendApiClient } from '@/lib/api/server';

export default async function GoalsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [dictionary, api] = await Promise.all([
    getDictionary(lang),
    getBackendApiClient(),
  ]);
  const goals = await api.listGoals();
  const copy = dictionary.goals;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10 pt-2 sm:pt-4">
      <header className="border-b border-border/70 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <StarBorder
              aria-hidden="true"
              as="span"
              className="grid size-9 place-items-center bg-[var(--dashboard-accent-soft)] text-[var(--dashboard-accent)]"
            >
              <GoalIcon className="size-full" />
            </StarBorder>
            <h1 className="text-2xl font-semibold tracking-[-0.025em] sm:text-[1.75rem]">
              {copy.title}
            </h1>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {copy.description}
          </p>
        </div>
      </header>

      <GoalsTable copy={copy} goals={goals} locale={lang} />
    </div>
  );
}
