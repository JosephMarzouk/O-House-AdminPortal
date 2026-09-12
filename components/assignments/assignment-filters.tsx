'use client';

import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export type FilterValues = {
  status?: string;
  site?: string;
  who?: string;
  from?: string;
  to?: string;
};

export type Option = { value: string; label: string };

/**
 * Place / assignee / date filters. Status is handled by the chip links in the
 * page itself — those enumerate cleanly, these do not.
 *
 * Lives inside the ink header block, so the labels are paper-on-ink; the
 * controls keep their surface fill, which is what lifts them off the ink.
 *
 * The URL is the state. Current values arrive as props rather than through
 * useSearchParams: the page is already a Server Component reading
 * searchParams, and reading it a second time here would duplicate the source
 * of truth (and drag in the Suspense requirement that hook carries on
 * prerendered routes).
 *
 * Strings are passed in pre-translated — lib/i18n/index.ts reads next/headers
 * and cannot cross into a client component.
 */
export function AssignmentFilters({
  values,
  sites,
  staff,
  labels,
}: {
  values: FilterValues;
  sites: Option[];
  staff: Option[];
  labels: {
    place: string;
    assignee: string;
    from: string;
    to: string;
    all: string;
    reset: string;
  };
}) {
  const router = useRouter();

  const set = (key: keyof FilterValues, value: string) => {
    const next: FilterValues = { ...values, [key]: value || undefined };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v);
    const q = qs.toString();
    // replace, not push: stepping back through every dropdown twiddle is not
    // history anyone wants. scroll:false keeps the list where the eye left it.
    router.replace(q ? `/assignments?${q}` : '/assignments', { scroll: false });
  };

  const hasAny = Boolean(values.status || values.site || values.who || values.from || values.to);
  const labelClass = 'text-label uppercase text-paper/60';

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-44 flex-col gap-1">
        <span className={labelClass}>{labels.place}</span>
        <Select compact value={values.site ?? ''} onChange={(e) => set('site', e.target.value)}>
          <option value="">{labels.all}</option>
          {sites.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex min-w-44 flex-col gap-1">
        <span className={labelClass}>{labels.assignee}</span>
        <Select compact value={values.who ?? ''} onChange={(e) => set('who', e.target.value)}>
          <option value="">{labels.all}</option>
          {staff.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>{labels.from}</span>
        <Input
          compact
          type="date"
          dir="ltr"
          value={values.from ?? ''}
          onChange={(e) => set('from', e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>{labels.to}</span>
        <Input
          compact
          type="date"
          dir="ltr"
          value={values.to ?? ''}
          onChange={(e) => set('to', e.target.value)}
        />
      </label>

      {hasAny && (
        <button
          type="button"
          onClick={() => router.replace('/assignments', { scroll: false })}
          className="h-control rounded-control px-3 text-sm text-paper/80 underline underline-offset-4 transition-colors hover:text-paper"
        >
          {labels.reset}
        </button>
      )}
    </div>
  );
}
