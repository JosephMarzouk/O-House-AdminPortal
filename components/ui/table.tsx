import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Broadsheet table: 14px cells, 11px uppercase tracked headers over a single
 * divider, hairline row rules at text@8%, hover at text@4%, selected rows on
 * the cyan tint. No zebra striping, no outer border, no fill — the table sits
 * straight on the paper and its columns are the structure.
 *
 * Text is start-aligned; callers right-align numbers with `text-end
 * tabular-nums`. On paper nothing scrolls, so a slightly wide table runs into
 * the margin rather than being cut off.
 */
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto print:overflow-visible">
      <table data-slot="table" className={cn('w-full text-sm', className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b [&_tr]:border-divider [&_tr]:hover:bg-transparent', className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-text/8 transition-colors hover:bg-text/4 data-[state=selected]:bg-cyan-tint',
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-control px-3 text-start align-middle text-label uppercase text-text/60 whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn('px-3 py-3 text-start align-middle whitespace-nowrap', className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };
