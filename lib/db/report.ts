import { listTasksBetween } from '@/lib/db/assignments';
import { listPlaces } from '@/lib/db/places';
import { listProfiles } from '@/lib/db/users';
import { taskDepartment } from '@/lib/report';

/**
 * A report's checklists: every task overlapping `from`..`to`, kept to one
 * department (taskDepartment) unless `deptId` is null. The report page and
 * the email summary both read through here, so they always agree.
 * RLS scopes it to the caller.
 */
export async function reportRows(from: string, to: string, deptId: string | null) {
  const [tasks, places, profiles] = await Promise.all([listTasksBetween(from, to), listPlaces(), listProfiles()]);
  const placeDept = new Map(places.map((p) => [p.id, p.department_id]));
  const personDept = new Map(profiles.map((p) => [p.id, p.department_id]));
  return {
    rows: tasks.rows.filter((a) => !deptId || taskDepartment(a, placeDept, personDept) === deptId),
    /** The query's count before the row limit, for "n of total". */
    total: tasks.total,
    fetched: tasks.rows.length,
    profiles,
  };
}
