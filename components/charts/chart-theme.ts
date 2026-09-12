/**
 * Chart colours, as literal hex rather than var(--accent-500).
 *
 * Two reasons. Recharts emits these as SVG presentation attributes
 * (stroke/fill), where var() support is uneven; and Broadsheet is a single
 * light palette with no dark mode, so there is exactly one set of values to
 * keep in step with globals.css rather than a theme to resolve at runtime.
 *
 * SERIES and LATE are the one pair this dashboard draws together. They were
 * checked with a colour-vision/contrast validator and pass on every count —
 * lightness band, chroma floor, CVD separation (ΔE 14.2 deutan) and contrast
 * against the card. Magenta is also the design system's reserved alarm colour,
 * used for rejected and expired and nothing else, so "late" is exactly the
 * job it is meant for.
 *
 * Do NOT add a third series colour from the blue ramp: #006786/#0088b0/#99e0ff
 * fail as a categorical set (normal-vision ΔE 10.8 — indistinguishable even
 * with full colour vision). The bar charts are deliberately single-hue and
 * take their identity from the category label instead.
 */
export const SERIES = '#0088b0'; // --accent-500
export const LATE = '#aa0b56'; // --magenta-700
export const AXIS = '#605d5d'; // --neutral-600
export const GRID = 'rgba(32, 30, 29, 0.16)'; // --border

/** Matches .bg-card + --shadow-broadsheet + --radius, so a tooltip reads as
 *  part of the page rather than a recharts default. */
export const TOOLTIP_STYLE = {
  background: '#ffffff',
  border: `1px solid ${GRID}`,
  borderRadius: '2px',
  boxShadow: '0 3px 10px rgb(45 43 43 / 0.16)',
  fontFamily: 'inherit',
  fontSize: 12,
} as const;

export const TICK = { fill: AXIS, fontSize: 11 } as const;
