import {
  createContext,
  memo,
  useContext,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { Brain, ChevronDown, Dot, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export type ChainOfThoughtStepStatus = 'complete' | 'active' | 'pending';

interface ChainOfThoughtContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const ChainOfThoughtContext =
  createContext<ChainOfThoughtContextValue | null>(null);

function useChainOfThought(): ChainOfThoughtContextValue {
  const context = useContext(ChainOfThoughtContext);
  if (!context) {
    throw new Error(
      'ChainOfThought parts must be rendered inside <ChainOfThought>.',
    );
  }
  return context;
}

export interface ChainOfThoughtProps extends ComponentProps<'div'> {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

export const ChainOfThought = memo(function ChainOfThought({
  children,
  className,
  defaultOpen = true,
  onOpenChange,
  open,
  ...props
}: ChainOfThoughtProps) {
  const [isOpen, setIsOpen] = useControllableState({
    defaultProp: defaultOpen,
    onChange: onOpenChange,
    prop: open,
  });
  const value = useMemo(() => ({ isOpen, setIsOpen }), [isOpen, setIsOpen]);

  return (
    <ChainOfThoughtContext.Provider value={value}>
      <div className={cn('space-y-3', className)} data-chain-of-thought {...props}>
        {children}
      </div>
    </ChainOfThoughtContext.Provider>
  );
});

export type ChainOfThoughtHeaderProps = ComponentProps<typeof CollapsibleTrigger>;

export const ChainOfThoughtHeader = memo(function ChainOfThoughtHeader({
  children,
  className,
  ...props
}: ChainOfThoughtHeaderProps) {
  const { isOpen, setIsOpen } = useChainOfThought();

  return (
    <Collapsible onOpenChange={setIsOpen} open={isOpen}>
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground',
          className,
        )}
        {...props}
      >
        <Brain className="size-4 shrink-0 text-primary-strong" />
        <span className="min-w-0 flex-1 truncate text-left">
          {children ?? 'Chain of thought'}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </CollapsibleTrigger>
    </Collapsible>
  );
});

export type ChainOfThoughtContentProps = ComponentProps<typeof CollapsibleContent>;

export const ChainOfThoughtContent = memo(function ChainOfThoughtContent({
  children,
  className,
  ...props
}: ChainOfThoughtContentProps) {
  const { isOpen } = useChainOfThought();

  return (
    <Collapsible open={isOpen}>
      <CollapsibleContent
        className={cn(
          'space-y-3 text-popover-foreground outline-none',
          '[&>[data-status]:last-child_[data-chain-rail]]:hidden',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1',
          className,
        )}
        {...props}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
});

export interface ChainOfThoughtStepProps extends ComponentProps<'div'> {
  description?: ReactNode;
  icon?: LucideIcon;
  indicator?: ReactNode;
  label: ReactNode;
  status?: ChainOfThoughtStepStatus;
}

export const ChainOfThoughtStep = memo(function ChainOfThoughtStep({
  children,
  className,
  description,
  icon: Icon = Dot,
  indicator,
  label,
  status = 'complete',
  ...props
}: ChainOfThoughtStepProps) {
  return (
    <div
      className={cn(
        'flex gap-2.5 text-sm animate-in fade-in-0 slide-in-from-top-1',
        status === 'complete' && 'text-muted-foreground',
        status === 'active' && 'text-foreground',
        status === 'pending' && 'text-muted-foreground/50',
        className,
      )}
      data-status={status}
      {...props}
    >
      <div className="relative mt-0.5 w-4 shrink-0">
        {indicator ? (
          <span className="absolute left-1/2 top-0 -translate-x-1/2">
            {indicator}
          </span>
        ) : (
          <Icon className="size-4" />
        )}
        <span
          aria-hidden
          className="absolute -bottom-3 -mx-px left-1/2 top-6 w-px bg-border"
          data-chain-rail
        />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div
          className={cn(
            'leading-snug',
            status === 'active' && 'shimmer shimmer-duration-1800 font-semibold',
          )}
        >
          {label}
        </div>
        {description ? (
          <div className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
});

export type ChainOfThoughtSearchResultsProps = ComponentProps<'div'>;

export const ChainOfThoughtSearchResults = memo(
  function ChainOfThoughtSearchResults({
    className,
    ...props
  }: ChainOfThoughtSearchResultsProps) {
    return (
      <div
        className={cn('flex flex-wrap items-center gap-1.5', className)}
        {...props}
      />
    );
  },
);

export type ChainOfThoughtSearchResultProps = ComponentProps<typeof Badge>;

export const ChainOfThoughtSearchResult = memo(
  function ChainOfThoughtSearchResult({
    className,
    ...props
  }: ChainOfThoughtSearchResultProps) {
    return (
      <Badge
        className={cn('max-w-full truncate font-normal', className)}
        variant="secondary"
        {...props}
      />
    );
  },
);
