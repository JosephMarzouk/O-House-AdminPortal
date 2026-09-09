import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listAssignments, itemCountsFor } from '@/lib/db/assignments';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { fmtDate, fmtWindow } from '@/lib/format';
import { StatusBadge } from '@/components/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function AssignmentsPage() {
  const [dict, locale, rows] = await Promise.all([getDictionary(), getLocale(), listAssignments()]);
  const counts = await itemCountsFor(rows.map((r) => r.id!).filter(Boolean));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{dict.navAssignments}</h1>
        {/* nativeButton={false}: Base UI defaults to expecting a real
            <button>, and this renders an <a>. */}
        <Button nativeButton={false} render={<Link href="/assignments/new" />}>
          <Plus className="size-4" />
          {dict.newAssignment}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">{dict.noData}</p>
      ) : (
        <div className="overflow-x-auto bg-card shadow-[var(--shadow-broadsheet)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{dict.place}</TableHead>
                <TableHead className="text-start">{dict.assignee}</TableHead>
                <TableHead className="text-start">{dict.date}</TableHead>
                <TableHead className="text-start">{dict.window}</TableHead>
                <TableHead className="text-start">{dict.progress}</TableHead>
                <TableHead className="text-start">{dict.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const c = counts.get(a.id!) ?? { total: 0, done: 0 };
                // The app renders title_* as the card heading and site_name_*
                // as the place line. Fall back to template_title_* for the one
                // legacy row whose title columns are empty.
                const title =
                  bilingual(locale, a.title_ar, a.title_en) ||
                  bilingual(locale, a.template_title_ar, a.template_title_en);
                const place = bilingual(locale, a.site_name_ar, a.site_name_en);

                return (
                  <TableRow key={a.id}>
                    <TableCell className="text-start">
                      <Link href={`/assignments/${a.id}`} className="font-semibold hover:underline">
                        {title || '—'}
                      </Link>
                      {place && (
                        <div className="text-xs text-muted-foreground">{place}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-start">{a.inspector_name || '—'}</TableCell>
                    <TableCell className="text-start">{fmtDate(a.scheduled_date, locale)}</TableCell>
                    <TableCell className="text-start tabular-nums" dir="ltr">
                      {fmtWindow(a.window_start, a.window_end) ?? '—'}
                    </TableCell>
                    <TableCell className="text-start tabular-nums">
                      {c.total === 0 ? (
                        // Zero items means the phone shows 0/0 with Submit
                        // permanently disabled — worth flagging, not hiding.
                        <span className="text-destructive">0 / 0</span>
                      ) : (
                        `${c.done} / ${c.total}`
                      )}
                    </TableCell>
                    <TableCell className="text-start">
                      <StatusBadge
                        status={a.effective_status}
                        dict={dict}
                        extended={a.was_extended}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
