/**
 * Evidence rules safe for client components (lib/media.ts is server-only).
 */

/** A camera clip rather than a photo: `….mp4`, before any signed-link query. */
export const isVideo = (url: string) => /\.mp4(\?|$)/i.test(url);
