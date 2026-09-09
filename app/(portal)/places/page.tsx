import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { listPlaces, listDepartments, templateItems } from '@/lib/db/places';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { DeletePlaceButton } from '@/components/places/delete-place-button';
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{dict.navPlaces}</h1>
        <Button nativeButton={false} render={<Link href="/places/new" />}>
          <Plus className="size-4" />
          {dict.newPlace}
        </Button>
      </div>

      {places.length === 0 ? (
        <p className="text-muted-foreground">{dict.noData}</p>
      ) : (
        <div className="overflow-x-auto bg-card shadow-[var(--shadow-broadsheet)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{dict.place}</TableHead>
                <TableHead className="text-start">{dict.department}</TableHead>
                <TableHead className="text-start">{dict.itemsCount}</TableHead>
                <TableHead className="text-start">{dict.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {places.map((p) => {
                const dept = p.department_id ? deptById.get(p.department_id) : undefined;
                const count = templateItems(p.items).length;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-start">
                      <Link href={`/places/${p.id}`} className="font-semibold hover:underline">
                        {bilingual(locale, p.title_ar, p.title_en) || '—'}
                      </Link>
                      {/* A place with no site twin can never be assigned:
                          create_assignment requires p_site_id. */}
                      {!p.site_id && (
                        <div className="text-xs text-destructive">no site link</div>
                      )}
                    </TableCell>
                    <TableCell className="text-start">
                      {dept ? bilingual(locale, dept.name_ar, dept.name_en) : dict.allDepartments}
                    </TableCell>
                    <TableCell className="text-start tabular-nums">{count}</TableCell>
                    <TableCell className="text-start">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={dict.edit}
                          nativeButton={false}
                          render={<Link href={`/places/${p.id}`} />}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <DeletePlaceButton id={p.id} dict={dict} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
