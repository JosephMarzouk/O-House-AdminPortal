'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { PlusIcon } from '@/components/icons';
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
import { ConfirmDeleteButton } from '@/components/ui/confirm-delete-button';
import { errorMessage } from '@/lib/errors';
import type { DepartmentOption } from '@/lib/options';

export function DepartmentsManager({
  departments,
  dict,
}: {
  departments: DepartmentOption[];
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');

  return (
    <>
      {/* The create row sits straight on the paper — whitespace separates it
          from the list below, not a box. */}
      <form
        className="flex max-w-3xl flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await createDepartment(nameAr, nameEn);
            if (res.ok) {
              alert.success(dict.saved);
              setNameAr('');
              setNameEn('');
              router.refresh();
            } else {
              alert.error(errorMessage(dict, res.error));
            }
          });
        }}
      >
        <div className="min-w-44 flex-1 space-y-1">
          <Label htmlFor="d-ar">{dict.departmentNameAr}</Label>
          <Input id="d-ar" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        </div>
        <div className="min-w-44 flex-1 space-y-1">
          <Label htmlFor="d-en">{dict.departmentNameEn}</Label>
          <Input id="d-en" dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </div>
        <Button type="submit" disabled={pending}>
          <PlusIcon />
          {dict.create}
        </Button>
      </form>

      {departments.length === 0 ? (
        <p className="text-text/55">{dict.noData}</p>
      ) : (
        <div className="max-w-3xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.departmentNameAr}</TableHead>
                <TableHead>{dict.departmentNameEn}</TableHead>
                <TableHead>{dict.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.nameAr || dict.none}</TableCell>
                  <TableCell dir="ltr">{d.nameEn || dict.none}</TableCell>
                  <TableCell>
                    {/* Postgres refuses while staff or places still reference
                        this department; the shared button reports that as
                        still_referenced rather than as the driver's own
                        sentence, which named the constraint. */}
                    <ConfirmDeleteButton dict={dict} onDelete={() => deleteDepartment(d.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
