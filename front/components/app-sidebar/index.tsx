'use client';

import {
  BriefcaseBusiness,
  Cpu,
  FilePenLine,
  KanbanSquare,
  LayoutDashboard,
  PlugZap,
  SlidersHorizontal,
  Target,
  Video,
} from 'lucide-react';
import type * as React from 'react';
import Logo from '@/components/logo';
import { TopNav } from '@/components/top-nav';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail, useSidebar } from '@/components/ui/sidebar';
import { StarBorder } from '@/components/ui/star-border';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { cn } from '@/lib/utils';

export function AppSidebar({
  locale,
  copy,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  locale: Locale;
  copy: Dictionary['navigation'];
}) {
  const { state } = useSidebar();

  // Grouped by what a freelancer does: the daily work, the inputs that shape
  // every analysis and proposal, and how this install is wired up.
  const groups = [
    {
      label: copy.groupWork,
      items: [
        { name: copy.overview, url: `/${locale}`, icon: LayoutDashboard, exact: true },
        { name: copy.applications, url: `/${locale}/applications`, icon: KanbanSquare },
        { name: copy.videos, url: `/${locale}/videos`, icon: Video },
      ],
    },
    {
      label: copy.groupAboutYou,
      items: [
        { name: copy.context, url: `/${locale}/context`, icon: BriefcaseBusiness },
        { name: copy.goals, url: `/${locale}/goals`, icon: Target },
        { name: copy.proposalStyle, url: `/${locale}/proposal-style`, icon: FilePenLine },
      ],
    },
    {
      label: copy.groupSettings,
      items: [
        { name: copy.connection, url: `/${locale}/settings/connection`, icon: PlugZap },
        { name: copy.models, url: `/${locale}/settings/models`, icon: Cpu },
        { name: copy.prompts, url: `/${locale}/settings/prompts`, icon: SlidersHorizontal },
      ],
    },
  ];

  return (
    <Sidebar
      className="[&_[data-slot=sidebar-inner]]:!rounded-none [&_[data-slot=sidebar-inner]]:!border-0 [&_[data-slot=sidebar-inner]]:!shadow-none"
      collapsible="icon"
      variant="floating"
      {...props}
    >
      <StarBorder className="flex h-full w-full flex-col bg-sidebar">
        <SidebarHeader className={cn('pt-4 group-data-[state=expanded]:pl-3 group-data-[state=collapsed]:items-center')}>
          <Logo compact={state === 'collapsed'} locale={locale} size="small" />
        </SidebarHeader>
        <SidebarContent>
          {groups.map((group) => (
            <TopNav items={group.items} key={group.label} label={group.label} />
          ))}
        </SidebarContent>
        <SidebarFooter className="px-4 pb-4 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          {copy.edition}
        </SidebarFooter>
      </StarBorder>
      <SidebarRail />
    </Sidebar>
  );
}
