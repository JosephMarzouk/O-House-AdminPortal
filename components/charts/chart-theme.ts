/**
 * Chart colours, read from the tokens in app/tokens.css.
 *
 * Recharts emits these as SVG presentation attributes (stroke/fill), and
 * presentation attributes are parsed as CSS values, so var() resolves there
 * exactly as it does in a stylesheet. tokens.css is `@theme static`, which
 * guarantees every variable is emitted even though Tailwind cannot see these
 * string usages.
 *
 * SERIES and LATE are the one pair this dashboard draws together. They were
 * checked with a colour-vision/contrast validator and pass on every count —
 * lightness band, chroma floor, CVD separation (ΔE 14.2 deutan) and contrast
 * against the paper. Magenta is also the design system's reserved alarm
 * colour, used for rejected and expired and nothing else, so "late" is
 * exactly the job it is meant for.
 *
 * Do NOT add a third series colour from the blue ramp: accent-700/500/300
 * fail as a categorical set (normal-vision ΔE 10.8 — indistinguishable even
 * with full colour vision). The bar charts are deliberately single-hue and
 * take their identity from the category label instead.
 */
export const SERIES = 'var(--color-cyan)';
export const LATE = 'var(--color-magenta)';
/** Axis ink. A mix of the body text rather than a fixed grey from the ramp:
 *  a ramp step is an absolute value and would stay dark when the page goes
 *  dark, where it disappears. This follows the theme, as CURSOR already does. */
export const AXIS = 'color-mix(in oklab, var(--color-text) 60%, transparent)';
export const GRID = 'var(--color-divider)';
export const CURSOR = 'color-mix(in oklab, var(--color-text) 6%, transparent)';

/** Matches a card on the surface fill with the mid shadow, so a tooltip reads
 *  as part of the page rather than a recharts default. */
export const TOOLTIP_STYLE = {
  background: 'var(--color-surface)',
  border: `var(--spacing-hairline) solid ${GRID}`,
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--shadow-md)',
  fontFamily: 'inherit',
  fontSize: 'var(--text-xs)',
} as const;

export const TICK = { fill: AXIS, fontSize: 'var(--text-caption)' } as const;
