import { useId } from 'react';

/**
 * The O West Sports Club mark, drawn rather than loaded.
 *
 * It replaces public/owest.png, which has the navy ground baked into the file.
 * That was invisible in the drawer, which is ink anyway, but on the login card
 * it read as a slightly-wrong navy square. Drawn in currentColor there is no
 * ground at all, one file serves 32px and 72px, and it follows the theme.
 *
 * Every number below is measured off the original PNG (292×267) and scaled by
 * 0.5455 into this 100-unit box, so the proportions are the artwork's, not an
 * eyeballing of it: O centre (147.5, 121.5) r 68.5×67.5 outer / 48.5×61.5
 * inner, WEST cap height 16 centred in the counter, SPORTS CLUB on a baseline
 * circle of radius 102 spanning 150.5°–29.5°.
 *
 * The O is one path with fill-rule="evenodd" rather than a stroked ellipse:
 * its counter is taller than it is wide, which is what gives the letter its
 * 20px sides and 6px top. A stroke would come out monoline — a different mark.
 *
 * The serif stack is not a second UI family. DESIGN.md's one-family rule is
 * about type the portal sets; this is a logo, and Cairo would restyle the
 * brand rather than render it.
 */

const SERIF = "ui-serif, Georgia, 'Times New Roman', serif";

export function BrandMark({ className }: { className?: string }) {
  // Two marks can share a page — the drawer plus anything that ever prints a
  // header — and a duplicated path id would silently win for both.
  const arc = useId();

  return (
    // -1 -1 102 102, not 0 0 100 100: the S and the B at the ends of the arc
    // reach x -0.6 and 100.5, and an <svg> clips to its viewBox by default, so
    // a square box on the nose shaves them.
    <svg viewBox="-1 -1 102 102" className={className} aria-hidden fill="currentColor">
      <path
        fillRule="evenodd"
        d="M12.6 40.5a37.4 36.8 0 1 0 74.8 0a37.4 36.8 0 1 0 -74.8 0Z
           M23.5 40.5a26.5 33.5 0 1 0 53 0a26.5 33.5 0 1 0 -53 0Z"
      />
      {/* Explicit alphabetic baseline, not dominant-baseline: cap height is
          what has to sit centred in the counter, and the em box the keyword
          would centre is a different, font-dependent height. */}
      <text x="50" y="44.8" textAnchor="middle" fontFamily={SERIF} fontSize="12.5">
        WEST
      </text>

      {/* Left to right through the bottom, so the letters stand on the arc
          with their tops toward the O, which is how the original reads. */}
      <path id={arc} d="M1.6 67.9A55.6 55.6 0 0 0 98.4 67.9" fill="none" />
      <text fontFamily={SERIF} fontSize="11.7" letterSpacing="3.55">
        <textPath href={`#${arc}`} startOffset="50%" textAnchor="middle">
          SPORTS CLUB
        </textPath>
      </text>
    </svg>
  );
}
