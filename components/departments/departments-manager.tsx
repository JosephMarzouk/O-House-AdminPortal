'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { createDepartment, deleteDepartment } from '@/lib/actions/departments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Dictionary } from '@/lib/i18n/dictionaries';

export type DepartmentRow = { id: string; nameAr: string; nameEn: string };

export function DepartmentsManager({
  departments,
  dict,
}: {
  departments: DepartmentRow[];
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');

  return (
    <div className="space-y-6">
      <form
        className="flex max-w-2xl flex-wrap items-end gap-3 bg-card p-4 shadow-[var(--shadow-broadsheet)]"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await createDepartment(nameAr, nameEn);
            if (res.ok) {
              toast.success(dict.saved);
              setNameAr('');
              setNameEn('');
              router.refresh();
            } else {
              toast.error(res.error === 'fields_required' ? dict.fieldsRequired : res.error);
            }
          });
        }}
      >
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor="d-ar">{dict.departmentNameAr}</Label>
          <Input id="d-ar" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        </div>
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor="d-en">{dict.departmentNameEn}</Label>
          <Input id="d-en" dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </div>
        <Button type="submit" disabled={pending}>
          <Plus className="size-4" />
          {dict.create}
        </Button>
      </form>

      {departments.length === 0 ? (
        <p className="text-muted-foreground">{dict.noData}</p>
      ) : (
        <div className="max-w-2xl overflow-x-auto bg-card shadow-[var(--shadow-broadsheet)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{dict.departmentNameAr}</TableHead>
                <TableHead className="text-start">{dict.departmentNameEn}</TableHead>
                <TableHead className="text-start">{dict.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-start">{d.nameAr || '—'}</TableCell>
                  <TableCell className="text-start" dir="ltr">
                    {d.nameEn || '—'}
                  </TableCell>
                  <TableCell className="text-start">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={dict.remove}
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(dict.confirmDelete)) return;
                        startTransition(async () => {
                          const res = await deleteDepartment(d.id);
                          if (res.ok) {
                            toast.success(dict.saved);
                            router.refresh();
                          } else {
                            // Postgres refuses while staff or places still
                            // reference this department — show why.
                            toast.error(res.error);
                          }
                        });
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
