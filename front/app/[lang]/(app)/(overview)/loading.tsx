import { ScoreTrendChartLoading } from '@/components/dashboard/score-trend-chart';
import { SectionMovementLoading } from '@/components/dashboard/section-movement';
import { CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StarBorder } from '@/components/ui/star-border';

export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading dashboard"
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10 pt-2 sm:pt-4"
    >
      <header className="space-y-3 border-b border-border/70 pb-6">
        <Skeleton className="h-9 w-52 rounded-xl" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </header>

      <StarBorder as="section" className="grid bg-card lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,2fr)]">
        <div className="space-y-5 p-6 sm:p-8">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-16 w-36" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="grid border-t border-dashed sm:grid-cols-2 lg:border-l lg:border-t-0 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              className="space-y-4 border-b border-dashed p-5 last:border-b-0 sm:p-6"
              key={index}
            >
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </StarBorder>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
        <LoadingCard>
          <ScoreTrendChartLoading />
        </LoadingCard>
        <LoadingCard>
          <Skeleton className="h-[342px] w-full rounded-xl" />
        </LoadingCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <LoadingCard>
          <Skeleton className="h-56 w-full rounded-xl" />
        </LoadingCard>
        <LoadingCard>
          <SectionMovementLoading />
        </LoadingCard>
      </section>
    </div>
  );
}

function LoadingCard({ children }: { children: React.ReactNode }) {
  return (
    <StarBorder className="min-w-0 bg-card text-card-foreground">
      <CardHeader className="space-y-2 px-5 pt-5 sm:px-6 sm:pt-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </CardHeader>
      <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
        {children}
      </CardContent>
    </StarBorder>
  );
}
