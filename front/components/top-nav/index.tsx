'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CornerBorder } from '@/components/ui/corner-border';

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

/**
 * An `exact` item is active only on its own path. The Overview needs it: it
 * lives at `/<locale>`, which prefixes every other page.
 */
export function isActivePath(pathname: string, url: string, exact = false) {
  if (pathname === url) return true;
  return !exact && pathname.startsWith(`${url}/`);
}

export function TopNav({
  items,
  label,
}: {
  /** The section title. It hides itself when the sidebar collapses to icons. */
  label?: string
  items: {
    name: string
    url: string
    icon: LucideIcon
    exact?: boolean
  }[]
}) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarMenu>
        {items.map((item) => {
          const active = isActivePath(pathname, item.url, item.exact);

          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton
                asChild
                className={active ? 'relative' : undefined}
                isActive={active}
                tooltip={item.name}
              >
                <Link
                  aria-current={active ? 'page' : undefined}
                  href={item.url}
                >
                  {active ? <CornerBorder /> : null}
                  <item.icon />
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
