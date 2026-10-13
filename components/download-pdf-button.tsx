'use client';

import { useState } from 'react';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { ReportIcon, SpinnerIcon } from '@/components/icons';
import { alert } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

/**
 * Downloads a day's (or a range's) report as a PDF file. The server prints it
 * (reports/daily/pdf/route.ts), which takes a few seconds, so the button says
 * so and holds still meanwhile.
 */
export function DownloadPdfButton({
  date,
  to,
  dept,
  label,
  dict,
  variant,
}: {
  date: string;
  /** The last day of a range report; absent for one day. */
  to?: string;
  /** A department id, or 'all'. */
  dept: string;
  label: string;
  dict: Dictionary;
  variant?: 'primary' | 'outline';
}) {
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    try {
      const res = await fetch(`/reports/daily/pdf?date=${date}${to ? `&to=${to}` : ''}&dept=${dept}`);
      // A lapsed session is a redirect to the login page's HTML, not an error.
      if (!res.ok || res.headers.get('content-type') !== 'application/pdf') {
        alert.error(res.status === 403 ? dict.noPermission : dict.errorGeneric);
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download =
        /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? `daily-report-${date}.pdf`;
      a.click();
      // Not at once: some browsers are still reading the blob after click().
      setTimeout(() => URL.revokeObjectURL(url), 40_000);
    } catch {
      alert.error(dict.errorGeneric);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button className="print:hidden" variant={variant} disabled={pending} onClick={download}>
      {pending ? <SpinnerIcon className="animate-spin" /> : <ReportIcon />}
      {pending ? dict.preparingPdf : label}
    </Button>
  );
}
