import { redirect } from 'next/navigation';

// Assignments are the job. There is no separate overview yet — the old
// portal's KPI cards averaged a `score` that only approve_assignment ever
// sets, so they would read as zero until reviewing is in use.
export default function PortalIndex() {
  redirect('/assignments');
}
