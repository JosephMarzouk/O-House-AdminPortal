/**
 * The club's zone as an admin enters it: the coordinates pasted from Google
 * Maps ("30.0444, 31.2357", right-click → the first line) and a radius in
 * metres. The form and the server action both run this, so the rule is
 * written once; the table's checks repeat the ranges.
 */
export const RADIUS_MIN = 50;
export const RADIUS_MAX = 2000;
export const RADIUS_DEFAULT = 200;

export type ClubZone = { lat: number; lng: number; radiusM: number };

export function parseLocation(coords: string, radius: number): ClubZone | null {
  const parts = coords.split(',').map((s) => s.trim());
  if (parts.length !== 2 || parts.includes('')) return null;
  const [lat, lng] = parts.map(Number);
  // NaN fails both comparisons.
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return null;
  if (!Number.isInteger(radius) || radius < RADIUS_MIN || radius > RADIUS_MAX) return null;
  return { lat, lng, radiusM: radius };
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
