import type { EffectiveStatus } from '@/lib/types/database';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { Tag, TagGroup } from '@/components/ui/tag';
import {
  StatusApprovedIcon,
  StatusExpiredIcon,
  StatusExtendedIcon,
  StatusFollowUpIcon,
  StatusInProgressIcon,
  StatusPendingIcon,
  StatusRejectedIcon,
  StatusSubmittedIcon,
} from '@/components/icons';

export const STATUS: Record<
  EffectiveStatus,
  { label: keyof Dictionary; Icon: typeof StatusPendingIcon }
> = {
  pending: { label: 'statusPending', Icon: StatusPendingIcon },
  in_progress: { label: 'statusInProgress', Icon: StatusInProgressIcon },
  follow_up: { label: 'statusFollowUp', Icon: StatusFollowUpIcon },
  submitted: { label: 'statusSubmitted', Icon: StatusSubmittedIcon },
  approved: { label: 'statusApproved', Icon: StatusApprovedIcon },
  rejected: { label: 'statusRejected', Icon: StatusRejectedIcon },
  expired: { label: 'statusExpired', Icon: StatusExpiredIcon },
};

/**
 * `status` comes from assignments_v.effective_status, never submissions.status
 * — a row past its window still reports 'pending' in the base table.
 *
 * "Extended" is an independent flag, so it renders as its own tag beside the
 * status rather than recolouring it.
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
  const { label, Icon } = STATUS[s];
  return (
    <TagGroup>
      <Tag tone={s} icon={<Icon />}>
        {dict[label]}
      </Tag>
      {extended && (
        <Tag tone="extended" icon={<StatusExtendedIcon />}>
          {dict.extended}
        </Tag>
      )}
    </TagGroup>
  );
}
