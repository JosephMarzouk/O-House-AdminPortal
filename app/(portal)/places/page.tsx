import Link from 'next/link';
import { PencilIcon, PlusIcon } from '@/components/icons';
import { listPlaces, listDepartments, templateItems } from '@/lib/db/places';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { fmtDate, fmtNum, todayInCairo } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { DeletePlaceButton } from '@/components/places/delete-place-button';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function PlacesPage() {
  const [dict, locale, places, departments] = await Promise.all([
    getDictionary(),
    getLocale(),
    listPlaces(),
    listDepartments(),
  ]);
  const deptById = new Map(departments.map((d) => [d.id, d]));

  return (
    <>
      <PageHeader
        kicker={fmtDate(todayInCairo(), locale)}
        title={dict.navPlaces}
        actions={
          <Button nativeButton={false} render={<Link href="/places/new" />}>
            <PlusIcon />
            {dict.newPlace}
          </Button>
        }
      />

      <PageBody>
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
                        className="font-semibold text-cyan-dark hover:underline"
                      >
                        {bilingual(locale, p.title_ar, p.title_en) || dict.none}
                      </Link>
                      {/* A place with no site twin can never be assigned:
                          create_assignment requires p_site_id. */}
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
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={dict.edit}
                          nativeButton={false}
                          render={<Link href={`/places/${p.id}`} />}
                        >
                          <PencilIcon />
                        </Button>
                        <DeletePlaceButton id={p.id} dict={dict} />
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
