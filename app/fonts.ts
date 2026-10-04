import { Cairo, Montserrat } from 'next/font/google';

/**
 * Montserrat for Latin, Cairo for Arabic.
 *
 * Montserrat is the clubs' brand face (the members' app and the staff app use
 * it). It has no Arabic glyphs, so --font-ui (app/tokens.css) lists Cairo
 * next and the browser takes each Arabic glyph from it. Both are variable
 * builds with the same 300–700 range, so the old Source Serif / Noto Naskh
 * trap (Arabic at 600 silently resolving to 700) does not come back.
 *
 * Latin subset only for Montserrat: nothing Arabic should ever render in it.
 */
export const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
});

export const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-cairo',
});
