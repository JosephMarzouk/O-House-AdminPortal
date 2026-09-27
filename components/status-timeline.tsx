import { fmtDateTime } from '@/lib/format';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import type { SubmissionEvent, SubmissionEventRow } from '@/lib/types/database';

const LABEL: Record<SubmissionEvent, keyof Dictionary> = {
  created: 'eventCreated',
  claimed: 'eventClaimed',
  reassigned: 'eventReassigned',
  started: 'eventStarted',
  submitted: 'eventSubmitted',
  follow_up: 'eventFollowUp',
  sent_back: 'eventSentBack',
  approved: 'eventApproved',
  extended: 'eventExtended',
};

/** Magenta is for the alarm states only: a send-back and a follow-up. */
const ALARM = new Set<SubmissionEvent>(['sent_back', 'follow_up']);

/**
 * A task's status history: created → started → submitted → sent back →
 * submitted → approved, each with who and when. Rendered on the task page and,
 * one per task, in the daily report.
 */
export function StatusTimeline({
  events,
  names,
  dict,
  locale,
}: {
  events: SubmissionEventRow[];
  /** profile id → name, for the "who" column. */
  names: Map<string, string>;
  dict: Dictionary;
  locale: Locale;
}) {
  if (events.length === 0) return <p className="text-sm text-text/55">{dict.noData}</p>;
  return (
    <ol className="space-y-1 border-s border-divider ps-4">
      {events.map((e) => (
        <li key={e.id} className="text-sm">
          <span className={ALARM.has(e.event) ? 'font-semibold text-magenta-deep' : 'font-semibold'}>
            {dict[LABEL[e.event]] ?? e.event}
          </span>
          <span className="text-text/55">
            {' · '}
            <span className="tabular-nums">{fmtDateTime(e.at, locale)}</span>
            {e.actor_id && names.get(e.actor_id) ? ` · ${names.get(e.actor_id)}` : ''}
          </span>
          {e.note && <span className="block text-text/70">{e.note}</span>}
        </li>
      ))}
    </ol>
  );
}
