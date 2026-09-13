import { cn } from '@/lib/utils';

/**
 * Dashboard KPI tile — one of the two things that "float off the paper"
 * (the other is a floating bar): paper ground, 20px radius, the mid shadow,
 * a big serif number and an 11px uppercase label.
 *
 * `alarm` is for the rejected/overdue tile only: magenta-tint ground with
 * magenta-deep text, the single tinted tile on the page.
 */
function StatTile({ label, value, alarm }: { label: string; value: string; alarm?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-tile p-4 shadow-md shadow-(color:--color-shade)',
        alarm ? 'bg-magenta-tint text-magenta-deep' : 'bg-raised text-text',
      )}
    >
      <div className="text-display tabular-nums">{value}</div>
      <div className={cn('mt-1 text-label uppercase', alarm ? 'text-magenta-deep' : 'text-text/50')}>
        {label}
      </div>
    </div>
  );
}

export { StatTile };
