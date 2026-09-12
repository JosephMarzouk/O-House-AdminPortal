import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A card is for one discrete item — a subtask, a staff member, a template —
 * never for page layout. Surface fill, 2px radius, no border, no shadow:
 * Broadsheet is flat and "has no rounded cards". The optional kicker is the
 * 10px uppercase line above a title.
 */
function Card({
  kicker,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { kicker?: string }) {
  return (
    <div data-slot="card" className={cn('rounded-card bg-surface p-4', className)} {...props}>
      {kicker && <div className="mb-1 text-kicker uppercase text-cyan-dark">{kicker}</div>}
      {children}
    </div>
  );
}

export { Card };
