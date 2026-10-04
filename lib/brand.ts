import type { StaticImageData } from 'next/image';
import kodeLogo from '@/assets/tenants/kode/kode.png';
import owestLogo from '@/assets/tenants/owest/owest.png';
import ryzeLogo from '@/assets/tenants/ryze/ryze.png';

/**
 * Each club's brand: the portal's copy of the staff app's lib/tenant.dart,
 * keyed by the API's club slug. One deployment serves every club, so the
 * palette is picked per request (app/layout.tsx) rather than at build time.
 *
 * The scales are the members' app's palettes (br-clubs-mobile-app
 * colors.dart), shades 50..900, index 0..9. The roles are taken from them by
 * one rule, the same one tenant.dart documents:
 *   ink = primary 500, cyan = secondary 500, cyan-dark = the lightest
 *   secondary shade from 600 at 4.5:1 on paper, cyan-tint = secondary 50,
 *   on-cyan = white unless that is under 3:1 on cyan (RYZE), then ink.
 * The accent ramp (hover/pressed steps) is the secondary scale itself.
 */
export type Brand = {
  appName: { en: string; ar: string };
  logo: StaticImageData;
  primary: readonly string[];
  secondary: readonly string[];
  cyanDark: string;
  onCyan: string;
  gradientColor: string;
  gradientStops: readonly [number, number];
};

const WHITE = '#ffffff';

const brands = {
  ohouse: {
    appName: { en: 'O House', ar: 'أو هاوس' },
    logo: owestLogo,
    primary: ['#E4E5E9', '#C6C9D2', '#A0A4B3', '#7E8497', '#5A617A', '#1D2749', '#1A2342', '#171F3A', '#141B33', '#11172C'],
    secondary: ['#E5F4F5', '#BDE3E7', '#91D0D8', '#66BCC8', '#3AA8B7', '#229BA8', '#1E8D9A', '#1B7F8C', '#17717E', '#136370'],
    cyanDark: '#17717E',
    onCyan: WHITE,
    gradientColor: '#189AA7',
    gradientStops: [0.27, 0.88],
  },
  // TODO(club names): the clubs' official EN/AR names are still to confirm.
  ryze: {
    appName: { en: 'RYZE House', ar: 'رايز هاوس' },
    logo: ryzeLogo,
    primary: ['#E6EAEB', '#B1BFC2', '#8B9FA4', '#56747A', '#355961', '#032F39', '#032B34', '#022128', '#021A1F', '#011418'],
    // 500 is more orange than 600 in the source palette: deliberate there, kept.
    secondary: ['#F9F6ED', '#FCEBB6', '#FBE192', '#F9D360', '#F8CA41', '#F69F12', '#E0AC10', '#AF860D', '#87680A', '#674F08'],
    cyanDark: '#87680A',
    onCyan: '#032F39', // white on this orange is 2.1:1
    gradientColor: '#000000',
    gradientStops: [0.5, 0.9],
  },
  kode: {
    appName: { en: 'KODE House', ar: 'كود هاوس' },
    logo: kodeLogo,
    primary: ['#E5EAF4', '#D3DCEC', '#A7B8DA', '#7B95C7', '#4F71B5', '#234EA2', '#1C3E82', '#152F61', '#0E1F41', '#071020'],
    secondary: ['#FDEBE1', '#FCD1B8', '#F9B984', '#F68050', '#F25528', '#F26522', '#B34C1A', '#7F3513', '#4B1D0C', '#1F0804'],
    cyanDark: '#B34C1A',
    onCyan: WHITE,
    gradientColor: '#010D24',
    gradientStops: [0.24, 0.88],
  },
} satisfies Record<string, Brand>;

/** A host that resolves to no club (a 404 page) still renders as O House. */
export function brandFor(slug: string | null | undefined): Brand {
  return (slug && (brands as Record<string, Brand>)[slug]) || brands.ohouse;
}

/**
 * The club's overrides of app/tokens.css. `html:root` (0,1,1) beats the
 * tokens' `:root` (0,1,0), and the dark rules (0,2,1) beat their (0,2,0), so
 * source order never matters. Only brand roles appear here: paper, surface,
 * text and magenta are the same for every club.
 *
 * Every value is a constant from this file, never request data, so nothing a
 * user types can reach the <style> this ends up in.
 */
export function brandCss(b: Brand): string {
  const s = b.secondary;
  const ramp = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `--color-accent-${i}00:${s[i]};`).join('');
  const [a, z] = b.gradientStops.map((n) => `${Math.round(n * 100)}%`);
  return (
    `html:root{--color-ink:${b.primary[5]};--color-cyan:${s[5]};--color-cyan-dark:${b.cyanDark};` +
    `--color-cyan-tint:${s[0]};--color-on-cyan:${b.onCyan};${ramp}` +
    `--gradient-login:linear-gradient(to bottom right,${b.primary[5]} ${a},${b.gradientColor} ${z});}` +
    // Dark grounds need the light end of the scale for text, the dark end for tints.
    `html:root[data-theme='dark'],html [data-theme='dark']:not(:root){--color-cyan-dark:${s[2]};--color-cyan-tint:${s[9]};}`
  );
}
