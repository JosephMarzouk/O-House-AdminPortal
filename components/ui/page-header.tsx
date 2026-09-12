import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeftIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * The ink header block every portal page starts with — the one dark surface
 * in the system. Flush with the top of the viewport, 28px bottom corners,
 * paper text; the brand logo sits in the top-end corner, then an 11px
 * tracked kicker, the display-size title and one subtitle line.
 *
 * Anything that belongs "inside the ink" — a filter row, a status chip row,
 * a search field — is passed as children and sits at the bottom of the
 * block rather than below it. `actions` (a New… button) sits at the end of
 * that same row.
 */
function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  children,
}: {
  /** A date, a section name, or a back link. */
  kicker: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="relative flex min-h-header flex-col rounded-b-header bg-ink px-8 pt-6 pb-6 text-paper">
      {/* width/height are next/image's intrinsic size, not a style — the
          rendered box is size-logo from the tokens. */}
      <Image
        src="/owest.png"
        alt=""
        width={32}
        height={32}
        priority
        className="absolute end-8 top-6 size-logo rounded-card"
      />
      <div className="pe-12">
        <p className="text-label uppercase text-paper/60">{kicker}</p>
        <h1 className="mt-1 text-display">{title}</h1>
        {subtitle && <p className="mt-1 text-lg text-paper/70">{subtitle}</p>}
      </div>
      {(children || actions) && (
        <div className="mt-auto flex flex-wrap items-end gap-3 pt-6">
          {children}
          {actions && <div className="ms-auto">{actions}</div>}
        </div>
      )}
    </header>
  );
}

/** A back link for the kicker slot of a detail or create page. The negative
 *  margin widens the hit area to the 44px minimum without moving the text. */
function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-my-4 inline-flex min-h-control items-center gap-1 py-4 text-label uppercase text-paper/60 transition-colors hover:text-paper"
    >
      <ArrowLeftIcon className="size-icon-sm rtl:-scale-x-100" />
      {label}
    </Link>
  );
}

/** The paper body under the ink block. Sections inside are separated by
 *  whitespace alone — no rules, borders or boxes. */
function PageBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('space-y-8 px-8 py-8', className)} {...props} />;
}

export { PageHeader, PageBody, BackLink };
