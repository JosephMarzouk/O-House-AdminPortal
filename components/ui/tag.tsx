import * as React from 'react';
import { cn } from '@/lib/utils';

export type TagTone =
  | 'pending'
  | 'in_progress'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'follow_up'
  | 'extended';

/**
 * The status vocabulary, pixel for pixel with the staff app's chips. Seven
 * statuses plus the independent "extended" marker, which is its own tag set
 * beside the status — never an amber warning icon. Magenta appears only on
 * the three alarm states, each in its own weight so they stay apart at a
 * glance: rejected is the solid fill, expired the outline, and follow-up the
 * tint — an answer that missed and is waiting on a fix, quieter than work
 * that was sent back.
 */
const TONES: Record<TagTone, string> = {
  pending: 'bg-surface text-text/60',
  in_progress: 'bg-cyan-tint text-cyan-dark',
  submitted: 'bg-accent-700 text-on-cyan',
  approved: 'bg-cyan text-on-cyan',
  rejected: 'bg-accent2-700 text-on-brand',
  expired: 'border border-magenta bg-transparent text-magenta',
  follow_up: 'bg-magenta-tint text-magenta-deep',
  extended: 'bg-surface text-text/60',
};

function Tag({
  tone,
  icon,
  className,
  children,
  ...props
}: React.ComponentProps<'span'> & { tone: TagTone; icon?: React.ReactNode }) {
  return (
    <span
      data-slot="tag"
      className={cn(
        // rounded-control, not rounded-card: CSS clamps a radius to half the
        // box, and a tag is ~19px tall, so 16px renders as a true pill while
        // the same token stays 16px on the taller controls it was made for.
        'inline-flex items-center gap-1 rounded-control px-2 py-tag-y text-tag whitespace-nowrap',
        '[&_svg]:size-icon-sm [&_svg]:shrink-0',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

/** Wrap so a status tag and the extended marker sit side by side and wrap
 *  together in a narrow cell. */
function TagGroup({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('inline-flex flex-wrap items-center gap-1', className)} {...props} />;
}

export { Tag, TagGroup };
