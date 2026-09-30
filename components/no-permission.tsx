import type * as React from 'react';
import { LockIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { cn } from '@/lib/utils';

/**
 * "You don't have permission": what the portal says instead of hiding a page
 * or a control. The lock is the roles editor's read-only lock.
 *
 * `page`: a centred block for a page the person may not open, in place of its
 * body. Otherwise a caption beside a greyed-out control; one per section,
 * not one per button.
 *
 * No hooks: server pages and client components both render it.
 */
export function NoPermission({
  dict,
  page,
  text,
  className,
}: {
  dict: Dictionary;
  page?: boolean;
  /** Defaults to noPermissionPage (page) or noPermission (inline). */
  text?: string;
  className?: string;
}) {
  if (page) {
    return (
      <div className={cn('flex flex-col items-center gap-3 py-16 text-center text-magenta', className)}>
        <LockIcon className="size-8" />
        <p className="text-lg">{text ?? dict.noPermissionPage}</p>
      </div>
    );
  }
  return (
    <p className={cn('flex items-center gap-2 text-sm text-magenta', className)}>
      <LockIcon className="size-icon-sm shrink-0" />
      {text ?? dict.noPermission}
    </p>
  );
}

/**
 * A page's "New …" button for someone without the permission: the same
 * button, greyed out, with the note under it. The title sits on the wrapper
 * because a disabled Button takes no pointer events.
 */
export function DeniedAction({
  dict,
  icon,
  label,
  variant,
  className,
}: {
  dict: Dictionary;
  icon?: React.ReactNode;
  label: string;
  variant?: 'primary' | 'outline';
  className?: string;
}) {
  return (
    <div title={dict.noPermission} className={cn('flex flex-col items-end gap-1', className)}>
      <Button variant={variant} disabled>
        {icon}
        {label}
      </Button>
      <NoPermission dict={dict} />
    </div>
  );
}
