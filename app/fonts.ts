import { Cairo } from 'next/font/google';

/**
 * Cairo is the portal's only family, for both scripts.
 *
 * It replaced a Source Serif 4 + Noto Naskh Arabic pair. That pair worked by
 * per-glyph fallback — Latin from the serif, Arabic from the Naskh — which
 * meant a single line mixing a name and a count was set in two typefaces with
 * different weight axes (Latin shipped 400/600, Arabic 400/700, so Arabic at
 * 600 silently resolved to 700). Cairo covers Arabic, Latin and the
 * Arabic-Indic digits `fmtNum` emits under ar-EG, so there is one face, one
 * weight axis, and nothing to fall through to.
 *
 * The variable build is deliberate: every weight from one file, so 400 body
 * and 600 headings cost no extra request. Cairo has no italic — nothing in
 * the portal sets italic, so there is no face to miss.
 */
export const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-cairo',
});
