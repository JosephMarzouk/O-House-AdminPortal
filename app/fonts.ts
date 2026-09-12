import localFont from 'next/font/local';

/**
 * Broadsheet's voice, self-hosted from the same TTFs the Flutter app ships
 * (plus the true italic, which the app does not carry).
 *
 * Source Serif 4 has no Arabic glyphs, so Noto Naskh Arabic sits behind it in
 * one stack — see --font-serif in app/tokens.css. The browser picks per glyph,
 * which is the CSS equivalent of the app's `fontFamilyFallback`. One stack
 * serves both locales; there is no per-locale branch anywhere.
 *
 * Note the weight asymmetry carried over from the app: Latin ships 400/600,
 * Arabic ships 400/700. Arabic at 600 resolves to 700.
 */

export const sourceSerif = localFont({
  src: [
    { path: './fonts/SourceSerif4-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/SourceSerif4-Semibold.ttf', weight: '600', style: 'normal' },
    // Google's variable italic build (opsz, wght axes). The browser only
    // fetches a face when something on the page is actually set in it.
    { path: './fonts/SourceSerif4-Italic.ttf', weight: '400', style: 'italic' },
  ],
  variable: '--font-source-serif',
  display: 'swap',
});

export const notoNaskh = localFont({
  src: [
    { path: './fonts/NotoNaskhArabic-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/NotoNaskhArabic-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-noto-naskh',
  display: 'swap',
});
