'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, MapPin, Users, Building2 } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { cn } from '@/lib/utils';

const ICONS = { assignments: ClipboardList, places: MapPin, users: Users, departments: Building2 };

export function PortalNav({ dict, isAdmin }: { dict: Dictionary; isAdmin: boolean }) {
  const pathname = usePathname();

  const items = [
    { href: '/assignments', key: 'assignments' as const, label: dict.navAssignments },
    { href: '/places', key: 'places' as const, label: dict.navPlaces },
    { href: '/departments', key: 'departments' as const, label: dict.navDepartments },
    // Only admins can change roles (set_user_role is admin-only), so the page
    // would be read-only for a manager. Hide rather than tease.
    ...(isAdmin ? [{ href: '/users', key: 'users' as const, label: dict.navUsers }] : []),
  ];

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2 text-sm transition-colors',
              'rounded-[var(--radius)]',
              active
                ? 'bg-[var(--sidebar-accent)] font-semibold text-[var(--sidebar-accent-foreground)]'
                : 'text-[var(--sidebar-foreground)]/75 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
