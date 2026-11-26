import Link from 'next/link';
import { DATE_PRESETS, type DatePreset } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Today / This week / This month (26 Nov): one press fills From and To
 * (presetRange in lib/format.ts). The same quiet chips as the Assignments
 * page's status filters; the chosen one is cyan.
 *
 * Buttons with `onPick` (a client filter bar), or links with `hrefFor` (a GET
 * form's page, no client JS). No 'use client' of its own: it works in both.
 */
export function DatePresetButtons({
  chosen,
  labels,
  onPick,
  hrefFor,
}: {
  chosen: DatePreset | null;
  labels: Record<DatePreset, string>;
  onPick?: (preset: DatePreset) => void;
  hrefFor?: (preset: DatePreset) => string;
}) {
  const chip = (active: boolean) =>
    cn(
      'inline-flex h-control items-center rounded-control px-3 text-sm font-semibold transition-colors',
      active ? 'bg-cyan text-on-cyan' : 'bg-surface text-text/70 hover:bg-text/7 hover:text-text',
    );

  return (
    <div className="flex flex-wrap gap-1" role="group">
      {DATE_PRESETS.map((p) =>
        hrefFor ? (
          <Link key={p} href={hrefFor(p)} scroll={false} aria-current={chosen === p ? 'true' : undefined} className={chip(chosen === p)}>
            {labels[p]}
          </Link>
        ) : (
          <button key={p} type="button" aria-pressed={chosen === p} onClick={() => onPick?.(p)} className={chip(chosen === p)}>
            {labels[p]}
          </button>
        ),
      )}
    </div>
  );
}
