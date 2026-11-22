import { CircleDashed, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Dictionary } from '@/i18n/types';

/**
 * Trusted vs draft, in one place. Both states are legitimate — a draft is not
 * an error — so neither reads as destructive.
 */
export function ContextStatusBadge({
  copy,
  trusted,
}: {
  copy: Dictionary['onboarding'];
  trusted: boolean;
}) {
  return trusted ? (
    <Badge className="gap-1.5 border-[var(--dashboard-accent)]/30 bg-[var(--dashboard-accent-soft)] px-2.5 py-1 text-[var(--dashboard-accent)]">
      <ShieldCheck className="size-3.5" strokeWidth={2.25} />
      {copy.trustedStatus}
    </Badge>
  ) : (
    <Badge className="gap-1.5 px-2.5 py-1" variant="outline">
      <CircleDashed className="size-3.5" strokeWidth={2.25} />
      {copy.draftStatus}
    </Badge>
  );
}
