import Link from 'next/link';
import { bilingual, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import { fmtDateTime } from '@/lib/format';
import type { RefusalRow } from '@/lib/db/sync';
import { refusalLabel, refusalOp } from '@/lib/refusals';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * SY-10: work a phone could not send. The staff member sees the same rows on
 * the phone with Retry / Dismiss; this is so a supervisor knows to extend a
 * window or chase it up. `showRound` is off on a round's own page.
 */
export function SyncRefusals({
  rows,
  dict,
  locale,
  showRound = true,
}: {
  rows: RefusalRow[];
  dict: Dictionary;
  locale: Locale;
  showRound?: boolean;
}) {
  return (
    <section>
      <h2 className="text-heading">{dict.syncProblems}</h2>
      <p className="mt-1 text-sm text-text/55">{dict.syncProblemsHint}</p>
      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.assignee}</TableHead>
              {showRound && <TableHead>{dict.navAssignments}</TableHead>}
              <TableHead>{dict.syncProblems}</TableHead>
              <TableHead className="text-end">{dict.date}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-semibold">{r.staff ?? dict.none}</TableCell>
                {showRound && (
                  <TableCell>
                    {r.assignment_id && r.round ? (
                      <Link className="underline" href={`/assignments/${r.assignment_id}`}>
                        {bilingual(locale, r.round.title_ar, r.round.title_en) || dict.none}
                      </Link>
                    ) : (
                      dict.none
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <span className="text-text/55">{refusalOp(r.op, dict)} · </span>
                  <span className="text-magenta-deep">{refusalLabel(r.code, dict)}</span>
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {fmtDateTime(r.created_at, locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
