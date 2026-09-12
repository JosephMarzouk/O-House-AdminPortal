'use client';

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { CheckIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

/** 20px box on the surface fill; checked is solid cyan. The ::after pad
 *  widens the hit area to the 44px minimum without growing the box. */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer relative flex size-4 shrink-0 items-center justify-center rounded-card border border-divider bg-surface',
        'transition-colors after:absolute after:-inset-x-3 after:-inset-y-2',
        'hover:border-text/45 disabled:cursor-not-allowed disabled:opacity-45',
        'data-checked:border-cyan data-checked:bg-cyan data-checked:text-paper',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current [&>svg]:size-icon-sm"
      >
        <CheckIcon weight="bold" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
