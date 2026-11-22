import { LoaderCircle, RotateCw, ScanSearch, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StarBorder } from '@/components/ui/star-border';
import type { PageState } from '@/features/extension/use-page-status';
import { useI18n } from '@/features/i18n/i18n-context';

/**
 * The shared start card of the Match and Draft screens. The button works only
 * while the active tab is a supported job post; otherwise the card says which
 * page to open.
 */
export function JobEntryCard({
  help,
  icon: Icon,
  onRecheckPage,
  onStart,
  pageState,
  title,
}: {
  help: string;
  icon: LucideIcon;
  onRecheckPage?: () => void;
  onStart: () => void;
  pageState: PageState;
  title: string;
}) {
  const { t } = useI18n();
  const missing = pageState === 'missing';

  return (
    <Card className="border-dashed" data-job-page={pageState}>
      <CardContent className="flex flex-col items-center px-5 py-10 text-center">
        <StarBorder
          aria-hidden="true"
          as="span"
          className="mb-4 flex size-11 items-center justify-center bg-primary/10 text-primary-strong"
        >
          <Icon className="size-5" />
        </StarBorder>
        <h2 className="text-sm font-semibold" role={missing ? 'status' : undefined}>
          {missing ? t('job.page.missing') : title}
        </h2>
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
          {missing ? t('job.page.missingHelp') : help}
        </p>
        <Button className="mt-5" disabled={pageState !== 'ready'} onClick={onStart}>
          {pageState === 'checking' ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <ScanSearch />
          )}{' '}
          {pageState === 'checking'
            ? t('job.page.checking')
            : t('job.analyzeAndDraft')}
        </Button>
        {missing && onRecheckPage ? (
          <button
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-strong outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/35"
            onClick={onRecheckPage}
            type="button"
          >
            <RotateCw aria-hidden className="size-3.5" />
            {t('profile.setup.recheck')}
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}
