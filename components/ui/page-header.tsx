import * as React from 'react';
import Link from 'next/link';
import { ArrowLeftIcon } from '@/components/icons';
import { LinkPending } from '@/components/ui/link-pending';
import { cn } from '@/lib/utils';

/**
 * The block that opens a page: a kicker line, then the title.
 *
 * It used to be a 140px ink slab with the logo in its top-end corner, which
 * cost a screenful of height before any content and put the brand on every
 * page. The brand now lives in the drawer, so this is plain paper — the same
 * ground as the body — and the page starts at its title.
 *
 * The kicker carries the date on list pages and a <BackLink> on detail and
 * create pages. A subtitle is only passed where it says something the title
 * does not; "12 · Places" under "Places" is not that.
 *
 * Anything that belongs with the title rather than in the body — a filter
 * row, a status chip — is passed as children and sits under it. `actions`
 * (a page's one New… button) sits at the end of that same row.
 */
function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  children,
}: {
  /** A date, a section name, or a <BackLink>. */
  kicker: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="px-8 pt-8">
      <p className="section-label">{kicker}</p>
      <h1 className="mt-1 text-display">{title}</h1>
      {subtitle && <p className="mt-1 text-lg text-text/55">{subtitle}</p>}
      {(children || actions) && (
        <div className="mt-6 flex flex-wrap items-end gap-3">
          {children}
          {actions && <div className="ms-auto">{actions}</div>}
        </div>
      )}
    </header>
  );
}

/** A back link for the kicker slot of a detail or create page. Cyan-dark
 *  because it is a link on paper, where base cyan is only 3:1. The negative
 *  margin widens the hit area to the 44px minimum without moving the text. */
function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      // relative anchors <LinkPending />'s dot; the negative end inset puts it
      // just past the label rather than inside it, so no padding is needed and
      // nothing about the existing hit area moves.
      className="relative -my-4 inline-flex min-h-control items-center gap-1 py-4 text-label uppercase text-cyan-dark transition-colors [&_.link-hint]:-end-2 hover:text-cyan"
    >
      <ArrowLeftIcon className="size-icon-sm rtl:-scale-x-100" />
      {label}
      <LinkPending />
    </Link>
  );
}

/** The body under the title block. Sections inside are separated by
 *  whitespace alone — no rules, borders or boxes. */
function PageBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('space-y-8 px-8 py-8', className)} {...props} />;
}

export { PageHeader, PageBody, BackLink };
