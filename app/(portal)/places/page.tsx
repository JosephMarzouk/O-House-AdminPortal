import Link from 'next/link';
import { PencilIcon, PlusIcon, PrinterIcon } from '@/components/icons';
import { listPlaces, listDepartments, templateItems } from '@/lib/db/places';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { fmtDate, fmtNum, todayInCairo } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { DeletePlaceButton } from '@/components/places/delete-place-button';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import { LinkPending } from '@/components/ui/link-pending';
import { SearchBox } from '@/components/search-box';
import { DeniedAction, NoPermission } from '@/components/no-permission';
import { can, getProfile } from '@/lib/auth';
import { parseOne } from '@/lib/db/assignments';
import { matchesQuery } from '@/lib/search';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const q = parseOne((await searchParams).q);
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  const kicker = fmtDate(todayInCairo(), locale);
  if (!can(me, 'places.view')) {
    return (
      <>
        <PageHeader kicker={kicker} title={dict.navPlaces} />
        <PageBody>
          <NoPermission page dict={dict} />
        </PageBody>
      </>
    );
  }
  // The sites / templates policies check the same keys; these only grey out.
  const canCreate = can(me, 'places.create');
  const canEdit = can(me, 'places.edit');
  const canDelete = can(me, 'places.delete');

  const [allPlaces, departments] = await Promise.all([listPlaces(), listDepartments()]);
  const deptById = new Map(departments.map((d) => [d.id, d]));
  // A handful of rows, so filtered here rather than in the query.
  const places = allPlaces.filter((p) => {
    const dept = p.department_id ? deptById.get(p.department_id) : undefined;
    return matchesQuery(q, p.title_en, p.title_ar, dept?.name_en, dept?.name_ar);
  });

  return (
    <>
      <PageHeader
        kicker={kicker}
        title={dict.navPlaces}
        actions={
          <div className="flex flex-wrap items-start gap-2">
            {/* QR-locked places: every place's sticker on one printable sheet. */}
            <Button variant="outline" className="relative" nativeButton={false} render={<Link href="/places/qr" />}>
              <PrinterIcon />
              {dict.printAllQr}
              <LinkPending />
            </Button>
            {canCreate ? (
              <Button className="relative" nativeButton={false} render={<Link href="/places/new" />}>
                <PlusIcon />
                {dict.newPlace}
                <LinkPending />
              </Button>
            ) : (
              <DeniedAction dict={dict} icon={<PlusIcon />} label={dict.newPlace} />
            )}
          </div>
        }
      >
        <SearchBox value={q} label={dict.search} />
      </PageHeader>

      <PageBody>
        {places.length > 0 && (!canEdit || !canDelete) && (
          <NoPermission dict={dict} text={dict.greyedNoPermission} />
        )}
        {places.length === 0 ? (
          <p className="text-text/55">{dict.noData}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.place}</TableHead>
                <TableHead>{dict.department}</TableHead>
                <TableHead className="text-end">{dict.itemsCount}</TableHead>
                <TableHead>{dict.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {places.map((p) => {
                const dept = p.department_id ? deptById.get(p.department_id) : undefined;
                const count = templateItems(p.items).length;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/places/${p.id}`}
                        className="relative [&_.link-hint]:-end-2 font-semibold text-cyan-dark hover:underline"
                      >
                        {bilingual(locale, p.title_ar, p.title_en) || dict.none}
                        <LinkPending />
                      </Link>
                      {/* A place with no site twin can never be assigned:
                          create_assignment requires p_site_id. */}
                      {p.qr_required && (
                        <div className="mt-1">
                          <Tag tone="pending">{dict.qrRequired}</Tag>
                        </div>
                      )}
                      {!p.site_id && (
                        <div className="text-caption text-magenta">{dict.placeHasNoSite}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {dept ? bilingual(locale, dept.name_ar, dept.name_en) : dict.allDepartments}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{fmtNum(count, locale)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={dict.edit}
                            nativeButton={false}
                            render={<Link href={`/places/${p.id}`} />}
                          >
                            <PencilIcon />
                          </Button>
                        ) : (
                          // The name still opens the place, read-only.
                          <span title={dict.noPermission} className="inline-flex">
                            <Button variant="ghost" size="icon" aria-label={dict.edit} disabled>
                              <PencilIcon />
                            </Button>
                          </span>
                        )}
                        <DeletePlaceButton id={p.id} dict={dict} denied={!canDelete} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </PageBody>
    </>
  );
}
