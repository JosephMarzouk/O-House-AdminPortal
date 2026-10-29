import { can, getProfile } from '@/lib/auth';
import { brandFor } from '@/lib/brand';
import { currentClub } from '@/lib/club';
import { listPlaces } from '@/lib/db/places';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { QrLabel, qrPayload } from '@/components/places/qr-label';
import { PrintButton } from '@/components/print-button';
import { BackLink, PageBody, PageHeader } from '@/components/ui/page-header';
import { NoPermission } from '@/components/no-permission';

/**
 * Every place's QR sticker on one sheet (QR-locked places), two to a row on
 * A4, so a club can print and stick them all in one go. Each label keeps to
 * one page (break-inside-avoid in QrLabel).
 */
export default async function PlacesQrPage() {
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  const back = (
    <span className="print:hidden">
      <BackLink href="/places" label={dict.back} />
    </span>
  );
  if (!can(me, 'places.view')) {
    return (
      <>
        <PageHeader kicker={back} title={dict.qrCodes} />
        <PageBody>
          <NoPermission page dict={dict} />
        </PageBody>
      </>
    );
  }
  const [places, club] = await Promise.all([listPlaces(), currentClub()]);
  const brand = brandFor(club.slug);
  const clubName = bilingual(locale, club.name.ar, club.name.en);
  // Walk-order doesn't exist here; by English name is how a printed stack is sorted.
  const labelled = places
    .filter((p) => p.qr_code)
    .sort((a, b) => (a.title_en || a.title_ar).localeCompare(b.title_en || b.title_ar));

  return (
    <>
      <style>{'@page { size: A4; margin: 10mm; } @media print { body { background: #fff; } }'}</style>
      <div className="print:hidden">
        <PageHeader kicker={back} title={dict.qrCodes} actions={<PrintButton label={dict.print} />} />
      </div>
      <PageBody>
        {labelled.length === 0 ? (
          <p className="text-text/55">{dict.noData}</p>
        ) : (
          <div className="flex flex-wrap gap-6 print:gap-4">
            {labelled.map((p) => (
              <QrLabel
                key={p.id}
                payload={qrPayload(club.slug, p.qr_code)}
                nameEn={p.title_en}
                nameAr={p.title_ar}
                brand={brand}
                clubName={clubName}
                dict={dict}
              />
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
