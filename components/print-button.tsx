'use client';

import { PrinterIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';

/** The browser's own print dialog, for the QR sticker sheets. Hidden on paper. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button className="print:hidden" onClick={() => window.print()}>
      <PrinterIcon />
      {label}
    </Button>
  );
}
