import * as React from 'react';
import { fieldClass } from '@/components/ui/input';
import { CaretDownIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * A native <select> in Broadsheet clothes. Native because every select in the
 * portal is a short enumerated list where the platform picker (keyboard
 * type-ahead, mobile wheel, screen-reader semantics) is strictly better than
 * anything rebuilt in JavaScript — the only thing the browser gets wrong is
 * the arrow, so appearance is reset and a Phosphor caret drawn in its place.
 *
 * `className` lands on the wrapper, so widths (min-w-44 …) size the whole
 * control, caret included.
 */
function Select({
  className,
  compact,
  ...props
}: React.ComponentProps<'select'> & {
  /** 44px instead of 56px — for filter rows and table cells. */
  compact?: boolean;
}) {
  return (
    <span className={cn('relative block', className)}>
      <select
        data-slot="select"
        className={cn(
          fieldClass,
          'cursor-pointer appearance-none pe-10',
          compact ? 'h-control' : 'h-control-lg',
        )}
        {...props}
      />
      <CaretDownIcon className="pointer-events-none absolute end-4 top-1/2 size-icon -translate-y-1/2 text-text/60" />
    </span>
  );
}

export { Select };
