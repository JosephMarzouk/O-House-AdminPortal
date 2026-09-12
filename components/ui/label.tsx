import * as React from 'react';
import { cn } from '@/lib/utils';

/** Field label: 12px at text@70%, sitting above its control. */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn('block text-field text-text/70 select-none', className)}
      {...props}
    />
  );
}

export { Label };
