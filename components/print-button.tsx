'use client';

import { ReportIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';

/**
 * Export = the browser's print dialog, where "Save as PDF" is the
 * destination. No PDF library: the browser already lays out Arabic and RTL
 * correctly, which PDF libraries do badly.
 *
 * The dark theme would print light text on the white page (browsers drop
 * backgrounds by default), so the page is switched to light for the print
 * and back afterwards.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button
      className="print:hidden"
      onClick={() => {
        const root = document.documentElement;
        const theme = root.dataset.theme;
        root.dataset.theme = 'light';
        window.addEventListener(
          'afterprint',
          () => {
            if (theme === undefined) delete root.dataset.theme;
            else root.dataset.theme = theme;
          },
          { once: true },
        );
        window.print();
      }}
    >
      <ReportIcon />
      {label}
    </Button>
  );
}
