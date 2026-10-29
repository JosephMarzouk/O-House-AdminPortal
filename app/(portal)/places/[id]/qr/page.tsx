import { notFound } from 'next/navigation';
import { can, getProfile } from '@/lib/auth';
import { brandFor } from '@/lib/brand';
import { currentClub } from '@/lib/club';
import { getPlace } from '@/lib/db/places';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { QrLabel, qrPayload } from '@/components/places/qr-label';
import { PrintButton } from '@/components/print-button';
import { BackLink, PageBody, PageHeader } from '@/components/ui/page-header';
import { NoPermission } from '@/components/no-permission';

/**
 * One place's QR sticker, to print (QR-locked places). The sidebar is
 * print:hidden in the portal layout; the header's back link and button are
 * hidden here, so the paper carries the label alone.
 */
export default async function PlaceQrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  const back = (
    <span className="print:hidden">
      <BackLink href={`/places/${id}`} label={dict.back} />
    </span>
  );
  if (!can(me, 'places.view')) {
    return (
      <>
        <PageHeader kicker={back} title={dict.printQr} />
        <PageBody>
          <NoPermission page dict={dict} />
        </PageBody>
      </>
    );
  }
  const [place, club] = await Promise.all([getPlace(id), currentClub()]);
  if (!place?.qr_code) notFound();

  return (
    <>
      <style>{'@page { size: A4; margin: 12mm; } @media print { body { background: #fff; } }'}</style>
      <div className="print:hidden">
        <PageHeader
          kicker={back}
          title={bilingual(locale, place.title_ar, place.title_en) || dict.printQr}
          subtitle={dict.printQr}
          actions={<PrintButton label={dict.print} />}
        />
      </div>
      <PageBody>
        <QrLabel
          payload={qrPayload(club.slug, place.qr_code)}
          nameEn={place.title_en}
          nameAr={place.title_ar}
          brand={brandFor(club.slug)}
          clubName={bilingual(locale, club.name.ar, club.name.en)}
          dict={dict}
        />
      </PageBody>
    </>
  );
}
