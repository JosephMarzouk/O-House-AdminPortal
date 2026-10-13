'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { saveReportMail } from '@/lib/actions/club-pages';
import { errorMessage } from '@/lib/errors';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { ReportMailFrequency } from '@/lib/types/database';

/**
 * The report emails: how often (daily / weekly / off) and, per department,
 * who gets that department's PDF at 23:30. The API's mail worker sends them
 * (o-house-api src/reports); `last` is its latest outcome per department.
 */
export function ReportMailForm({
  dict,
  frequency,
  sender,
  departments,
  readOnly,
}: {
  dict: Dictionary;
  frequency: ReportMailFrequency;
  /** The club mailbox the reports come from; one per club. */
  sender: string;
  /** One list per department, and first the 'all' list (every department in one email). */
  departments: { id: string; name: string; hint: string | null; emails: string[]; last: string | null; failed: boolean }[];
  /** Without club_settings.edit: the settings, but no way to change them. */
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initial = Object.fromEntries(departments.map((d) => [d.id, d.emails.join('\n')]));
  const [freq, setFreq] = useState(frequency);
  const [from, setFrom] = useState(sender);
  const [lists, setLists] = useState<Record<string, string>>(initial);
  const dirty =
    freq !== frequency || from !== sender || departments.some((d) => (lists[d.id] ?? '') !== initial[d.id]);

  return (
    <Card className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{dict.reportMail}</h2>
        <p className="mt-1 text-sm text-text/55">{dict.reportMailHint}</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await saveReportMail(freq, from, lists);
            if (res.ok) {
              alert.success(dict.saved);
              router.refresh();
            } else {
              alert.error(errorMessage(dict, res.error));
            }
          });
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="report-mail-frequency">{dict.reportMailFrequency}</Label>
          <Select
            id="report-mail-frequency"
            className="max-w-xs"
            disabled={readOnly}
            value={freq}
            onChange={(e) => setFreq(e.target.value as ReportMailFrequency)}
          >
            <option value="daily">{dict.reportMailDaily}</option>
            <option value="weekly">{dict.reportMailWeekly}</option>
            <option value="off">{dict.reportMailOff}</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="report-mail-sender">{dict.reportMailSender}</Label>
          <Input
            id="report-mail-sender"
            type="email"
            dir="ltr"
            className="max-w-md"
            placeholder="reports@club.com"
            readOnly={readOnly}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <p className="text-caption text-text/55">{dict.reportMailSenderHint}</p>
        </div>
        {departments.map((d) => (
          <div key={d.id} className="space-y-1">
            <Label htmlFor={`report-mail-${d.id}`}>{d.name}</Label>
            {d.hint && <p className="text-caption text-text/55">{d.hint}</p>}
            <Textarea
              id={`report-mail-${d.id}`}
              dir="ltr"
              rows={3}
              placeholder={dict.reportMailRecipients}
              readOnly={readOnly}
              value={lists[d.id] ?? ''}
              onChange={(e) => setLists({ ...lists, [d.id]: e.target.value })}
            />
            {d.last && <p className={d.failed ? 'text-caption text-magenta' : 'text-caption text-text/55'}>{d.last}</p>}
          </div>
        ))}
        {/* Greyed rather than hidden; the page carries the "view only" note. */}
        <span title={readOnly ? dict.noPermission : undefined} className="inline-flex">
          <Button type="submit" disabled={pending || !dirty || readOnly}>
            {dict.save}
          </Button>
        </span>
      </form>
    </Card>
  );
}
