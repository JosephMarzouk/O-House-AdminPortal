/**
 * The single place a storage URL is built. Nothing else may construct one.
 *
 * `checklist-media` holds four path shapes, written by two eras of client:
 *   photos/{assignment_id}/{item_id}-{micros}.jpg   current, assignment_items.photo_paths
 *   signatures/{assignment_id}-{micros}.png         current, submit_assignment
 *   signatures/{uuid}.png                           legacy
 *   answers/{uuid}.jpg                              legacy, submissions.answers[].photo_url
 *
 * And `submissions.signature_url` holds two incompatible VALUE shapes: the
 * legacy browser flow stored a full public URL, while submit_assignment writes
 * `p_signature_path` verbatim (a bare path). Assume either one and the other
 * renders broken — hence the branch below.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? 'checklist-media';

export function mediaUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl; // already a full URL
  const clean = pathOrUrl.replace(/^\/+/, '');
  // Encode each segment: '/' separates, but spaces and '#' in a name would
  // otherwise truncate the URL. Storage.upload never encoded, so tolerate it.
  const encoded = clean.split('/').map(encodeURIComponent).join('/');
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encoded}`;
}

/**
 * Objects outlive the rows that reference them — clients cannot delete (there
 * is no DELETE policy on storage.objects), so orphans accumulate and offline
 * retries write a second signature rather than overwriting. Always render from
 * signature_url / photo_paths; never list a prefix and guess.
 */
export function mediaUrls(paths: string[] | null | undefined): string[] {
  return (paths ?? []).map(mediaUrl).filter((u): u is string => u !== null);
}
