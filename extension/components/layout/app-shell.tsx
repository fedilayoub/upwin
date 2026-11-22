import type { ReactNode } from 'react';
import { BrandMark } from '@/components/shared/brand-mark';
import { AppNavigation } from '@/components/navigation/app-navigation';
import { StarBorder } from '@/components/ui/star-border';
import type { AppSection } from '@/features/navigation/types';
import { HeaderPreferences } from '@/features/theme/header-preferences';

interface AppShellProps {
  activeSection: AppSection;
  children: ReactNode;
  onNavigate: (section: AppSection) => void;
}

export function AppShell({
  activeSection,
  children,
  onNavigate,
}: AppShellProps) {
  return (
    <div className="min-h-dvh w-full max-w-[100vw] overflow-x-clip bg-background text-foreground">
      <StarBorder className="sticky top-2 z-20 mx-2 mt-2 mb-1 h-12 shrink-0 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 min-[340px]:top-3 min-[340px]:mx-4 min-[340px]:mt-3">
        <header className="flex h-full items-center justify-between gap-3 px-3">
          <BrandMark size="small" />
          <HeaderPreferences />
        </header>
      </StarBorder>

      <main
        className="mx-auto min-w-0 w-full max-w-[min(1180px,100vw)] px-3 pt-4 pb-24 min-[360px]:px-4 min-[360px]:pt-5 min-[760px]:px-6 min-[760px]:pt-6"
        data-slot="app-content"
      >
        {children}
      </main>

      <AppNavigation
        activeSection={activeSection}
        onNavigate={onNavigate}
      />
    </div>
  );
}
