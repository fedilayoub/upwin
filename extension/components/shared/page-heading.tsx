import type { LucideIcon } from 'lucide-react';
import { StarBorder } from '@/components/ui/star-border';

interface PageHeadingProps {
  description?: string;
  icon?: LucideIcon;
  title: string;
}

export function PageHeading({ description, icon: Icon, title }: PageHeadingProps) {
  return (
    <header className="space-y-1.5">
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <StarBorder
            aria-hidden="true"
            as="span"
            className="grid size-8 shrink-0 place-items-center bg-primary/10 text-primary-strong"
          >
            <Icon className="size-4" strokeWidth={2} />
          </StarBorder>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      </div>
      {description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}
