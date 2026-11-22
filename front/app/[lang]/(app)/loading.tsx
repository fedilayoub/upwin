import { Skeleton } from '@/components/ui/skeleton';
import { StarBorder } from '@/components/ui/star-border';

/**
 * The fallback for every signed-in page that has no `loading.tsx` of its own.
 *
 * Every page here is dynamic, and a dynamic route with no loading boundary is
 * neither prefetched nor shown until its server render finishes, so a sidebar
 * click used to leave the old page on screen for the whole round trip. With
 * this file the router swaps to the skeleton at once and streams the page in.
 *
 * It mirrors `PageHeader` plus two content blocks, which is the shape most of
 * these pages share. The dashboard keeps its own, closer skeleton.
 */
export default function ProtectedLoading() {
  return (
    <div
      aria-busy="true"
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10 pt-2 sm:pt-4"
      role="status"
    >
      <header className="space-y-3 border-b border-border/70 pb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0" />
          <Skeleton className="h-8 w-48 rounded-xl" />
        </div>
        <Skeleton className="h-5 w-full max-w-xl" />
      </header>

      <StarBorder as="section" className="space-y-4 bg-card p-5 sm:p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="grid gap-4 pt-2 sm:grid-cols-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </StarBorder>

      <StarBorder as="section" className="space-y-4 bg-card p-5 sm:p-6">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </StarBorder>
    </div>
  );
}
