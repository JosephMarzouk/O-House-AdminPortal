import { createClient } from '@/lib/supabase/server';

/**
 * The evidence bucket's size in bytes (media_storage_bytes, club_settings.view).
 * Null when it can't be read: the dashboard's warning is a nicety, never a
 * reason for the page to fail.
 */
export async function mediaStorageBytes(): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('media_storage_bytes');
  if (error) return null;
  return typeof data === 'number' ? data : Number(data ?? 0);
}
