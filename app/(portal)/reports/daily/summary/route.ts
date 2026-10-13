import type { NextRequest } from 'next/server';
import { can, getProfile } from '@/lib/auth';
import { reportRows } from '@/lib/db/report';
import { dictionaries } from '@/lib/i18n';
import { reportParams, reportSummary } from '@/lib/report';
import { STATUS } from '@/components/status-badge';

/**
 * A report's few lines for the email body (o-house-api src/reports): how many
 * checklists, by status, who submitted and whose are not done. Same params,
 * same rows and the same reports.view check as the PDF beside it, so the
 * summary always matches the attachment. Status names come in both languages
 * because the email carries both.
 */
export async function GET(request: NextRequest) {
  if (!can(await getProfile(), 'reports.view')) return new Response('Forbidden', { status: 403 });
  const params = reportParams(request.nextUrl.searchParams);
  if (!params) return new Response('Bad request', { status: 400 });

  const { rows } = await reportRows(params.date, params.to, params.dept === 'all' ? null : params.dept);
  const summary = reportSummary(rows);
  return Response.json(
    {
      ...summary,
      byStatus: summary.byStatus.map(({ status, n }) => ({
        status,
        n,
        en: dictionaries.en[STATUS[status].label],
        ar: dictionaries.ar[STATUS[status].label],
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
