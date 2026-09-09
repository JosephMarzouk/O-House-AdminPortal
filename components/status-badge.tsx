import type { EffectiveStatus } from '@/lib/types/database';
import type { Dictionary } from '@/lib/i18n/dictionaries';

const LABEL: Record<EffectiveStatus, keyof Dictionary> = {
  pending: 'statusPending',
  in_progress: 'statusInProgress',
  submitted: 'statusSubmitted',
  approved: 'statusApproved',
  rejected: 'statusRejected',
  expired: 'statusExpired',
};

/**
 * `status` comes from assignments_v.effective_status, never submissions.status
 * — a row past its window still reports 'pending' in the base table.
 *
 * The colour classes live in globals.css @layer components rather than as
 * Tailwind utilities, so a dynamic `status-${s}` is safe from purging.
 */
export function StatusBadge({
  status,
  dict,
  extended,
}: {
  status: EffectiveStatus | null;
  dict: Dictionary;
  extended?: boolean | null;
}) {
  const s: EffectiveStatus = status ?? 'pending';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`status-badge status-${s}`}>{dict[LABEL[s]]}</span>
      {extended && <span className="text-xs text-muted-foreground">{dict.extended}</span>}
    </span>
  );
}
