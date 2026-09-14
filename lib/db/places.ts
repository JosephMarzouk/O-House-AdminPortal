import { createClient } from '@/lib/supabase/server';
import type { Department, Site, Template } from '@/lib/types/database';

/**
 * A "place" is a row in `templates`: the location staff get assigned to, plus
 * the default subtask list for it. Every template also carries a `site_id`
 * pointing at its twin in `sites` — the same nine places typed twice, kept in
 * sync by migration 0007.
 *
 * That pairing is load-bearing. create_assignment takes p_site_id and copies
 * sites.name_* onto the assignment, and the phone renders the place from
 * those denormalized columns — it never reads templates at all. So picking a
 * place means passing BOTH ids through.
 */

// templateItems moved to lib/template-items.ts — a pure parser that needs to
// be importable without the server Supabase client this module creates.
// Re-exported so the five existing import sites did not have to move.
export { templateItems } from '@/lib/template-items';

export async function listPlaces(): Promise<Template[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listPlaces: ${error.message}`);
  return data ?? [];
}

export async function getPlace(id: string): Promise<Template | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('templates').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`getPlace: ${error.message}`);
  return data;
}

export async function listSites(): Promise<Site[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('sites').select('*').order('name_en');
  if (error) throw new Error(`listSites: ${error.message}`);
  return data ?? [];
}

export async function listDepartments(): Promise<Department[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('departments').select('*').order('created_at');
  if (error) throw new Error(`listDepartments: ${error.message}`);
  return data ?? [];
}
