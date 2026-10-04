import Image, { type StaticImageData } from 'next/image';

/**
 * The club's logo (lib/brand.ts), the same file its staff app shows.
 *
 * Every club's logo is light artwork on a transparent ground, drawn for a dark
 * surface, and the mark only ever sits on one: the ink drawer, and the login
 * card, which is dark for everybody. object-contain because the files are
 * not square (RYZE is 467×427).
 *
 * Decorative: the wordmark or the link's aria-label beside it names the club.
 */
export function BrandMark({ logo, className }: { logo: StaticImageData; className?: string }) {
  return <Image src={logo} alt="" aria-hidden className={`object-contain ${className ?? ''}`} />;
}
