import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { EffectiveStatus } from '@/lib/types/database';
import type { TagTone } from '@/components/ui/tag';

/**
 * The task tracker's rules, kept pure so scripts/check.ts can pin them.
 *
 * The board is a view of effective_status, not a second status: a card sits in
 * the column its assignment's status says, and a move is one of the three
 * review actions the portal already has. Nothing here writes a status.
 */

export const COLUMNS = ['todo', 'in_progress', 'follow_up', 'review', 'done', 'overdue'] as const;
export type Column = (typeof COLUMNS)[number];

/**
 * Every status lands in exactly one column. A total Record, so a status added
 * to EffectiveStatus is a compile error here rather than a card that silently
 * vanishes from the board.
 */
export const COLUMN_OF: Record<EffectiveStatus, Column> = {
  pending: 'todo',
  in_progress: 'in_progress',
  // reject_items() puts a round back to in_progress and never writes
  // 'rejected'; were it ever written, it is still work waiting on the
  // assignee, which is what In Progress means here.
  rejected: 'in_progress',
  follow_up: 'follow_up',
  submitted: 'review',
  approved: 'done',
  expired: 'overdue',
};

/** Each column wears its status's tag tone, so the board and the tags agree. */
export const COLUMN_TONE: Record<Column, TagTone> = {
  todo: 'pending',
  in_progress: 'in_progress',
  follow_up: 'follow_up',
  review: 'submitted',
  done: 'approved',
  overdue: 'expired',
};

export const COLUMN_LABEL: Record<Column, keyof Dictionary> = {
  todo: 'colTodo',
  in_progress: 'colInProgress',
  follow_up: 'colFollowUp',
  review: 'colReview',
  done: 'colDone',
  overdue: 'colOverdue',
};

/** approve_assignment, reject_items (with its dialog), extend_assignment (with its dialog). */
export type Move = 'approve' | 'send_back' | 'extend';

/**
 * The permission each move's function requires (private.require): approving
 * and sending back are review, more time is checklists.edit. A move I lack
 * stays on the card's menu, greyed out.
 */
export const MOVE_PERMISSION: Record<Move, string> = {
  approve: 'review.edit',
  send_back: 'review.edit',
  extend: 'checklists.edit',
};

/**
 * Where a card may be dropped, and what that drop does. Review moves only —
 * the club's rule:
 *
 *   In Review → Done         approve
 *   In Review → In Progress  send back (pick items, give a reason)
 *   Overdue   → To Do        more time, for a task nobody started
 *   Overdue   → In Progress  more time, for a task that was under way
 *
 * The Overdue target follows the RAW status because an extension only lifts
 * the clock: the card lands wherever the stored status already was.
 *
 * Nothing else moves. To Do and In Progress are driven by the assignee's own
 * work, and a follow-up clears only when the assignee's corrected answer
 * arrives — approve_assignment would refuse it anyway, since it only accepts
 * a round in 'submitted'.
 */
export function allowedMoves(
  effective: EffectiveStatus | null,
  raw: string | null,
): Partial<Record<Column, Move>> {
  if (effective === 'submitted') return { done: 'approve', in_progress: 'send_back' };
  if (effective === 'expired') {
    return raw === 'in_progress' ? { in_progress: 'extend' } : { todo: 'extend' };
  }
  return {};
}

/** A card, flattened on the server into display strings the client can render as-is. */
export type BoardTask = {
  id: string;
  title: string;
  place: string;
  round: string;
  assignee: string;
  date: string | null;
  window: string | null;
  effective: EffectiveStatus;
  raw: string | null;
  extended: boolean;
  done: number;
  total: number;
  followUp: number;
};
