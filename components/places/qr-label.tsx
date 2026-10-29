import QRCode from 'qrcode';
import { BrandMark } from '@/components/brand-mark';
import type { Brand } from '@/lib/brand';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/**
 * What the staff app reads off a place's sticker: `clubops:<clubSlug>:<qr_code>`.
 * The slug is the API's club slug (the one the portal's host resolved to), so
 * an app built for another club refuses the code; the app then matches
 * sha256(qr_code) against the locked checklist's qr_hash.
 */
export function qrPayload(clubSlug: string, qrCode: string): string {
  return `clubops:${clubSlug}:${qrCode}`;
}

/**
 * One printed sticker: the club's logo on an ink band (the logos are light
 * artwork, drawn for a dark ground), the place's name in English and Arabic,
 * and its QR code. The QR is drawn here, on the server, as an SVG data URL:
 * no client code, nothing fetched, and it prints sharp at any size.
 *
 * `print-color-adjust: exact` keeps the band when the browser would otherwise
 * drop backgrounds to save ink; break-inside-avoid keeps a label on one page
 * in the Print all sheet.
 */
export async function QrLabel({
  payload,
  nameEn,
  nameAr,
  brand,
  clubName,
  dict,
}: {
  payload: string;
  nameEn: string;
  nameAr: string;
  brand: Brand;
  clubName: string;
  dict: Dictionary;
}) {
  // Level M: a scuffed sticker still reads; the payload is short enough that
  // the code stays coarse.
  const svg = await QRCode.toString(payload, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
  return (
    <figure className="flex w-[90mm] break-inside-avoid flex-col overflow-hidden rounded-card border border-text/20 bg-white text-center text-black [print-color-adjust:exact]">
      <div className="flex items-center justify-center gap-3 bg-ink px-4 py-3 text-white">
        <BrandMark logo={brand.logo} className="size-logo" />
        <span className="font-semibold">{clubName}</span>
      </div>
      <figcaption className="space-y-1 px-4 pt-4">
        <p className="text-lg font-semibold" dir="ltr">
          {nameEn}
        </p>
        <p className="text-lg font-semibold" dir="rtl" lang="ar">
          {nameAr}
        </p>
      </figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
        alt={dict.printQr}
        className="mx-auto my-3 size-[60mm]"
      />
      <p className="px-4 pb-4 text-caption text-black/60">{dict.qrLabelHint}</p>
    </figure>
  );
}
