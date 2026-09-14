import type { Department } from '@/lib/types/database';

/**
 * A department in the shape the UI wants: the two names unwrapped from the
 * snake_case row, so `bilingual()` can pick one.
 *
 * Four pages each ran this same map inline, and three components each declared
 * the identical three-field shape under a different name — `Option`,
 * `DepartmentOption`, `DepartmentRow`. One name, one mapper.
 *
 * Deliberately not in lib/db/places.ts, where listDepartments lives: that
 * module imports the server Supabase client, so a client component importing
 * the type from there would drag next/headers into the browser bundle.
 */
export type DepartmentOption = { id: string; nameAr: string; nameEn: string };

export function toDepartmentOptions(departments: Department[]): DepartmentOption[] {
  return departments.map((d) => ({ id: d.id, nameAr: d.name_ar, nameEn: d.name_en }));
}
