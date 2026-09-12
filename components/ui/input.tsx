import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from '@/lib/utils';

/**
 * The one look every text-entry control shares — Input, Textarea and Select
 * all read from here so a form is one surface, not three.
 *
 * Surface fill, divider border, 16px radius. Hover darkens the border, focus
 * turns it cyan; the global focus outline is dropped here because the border
 * already carries the state and a ring around a 16px pill reads as two rings.
 * Invalid is signalled through aria-invalid so the colour and the semantics
 * cannot drift apart.
 */
export const fieldClass = cn(
  'w-full min-w-0 rounded-control border border-divider bg-surface px-4 text-base text-text',
  'transition-colors placeholder:text-text/65',
  'hover:border-text/45 focus:border-cyan focus-visible:outline-none',
  'disabled:cursor-not-allowed disabled:opacity-45',
  'aria-invalid:border-magenta',
);

function Input({
  className,
  compact,
  ...props
}: React.ComponentProps<'input'> & {
  /** 44px instead of 56px — for filter rows and table cells, never a form proper. */
  compact?: boolean;
}) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(fieldClass, compact ? 'h-control' : 'h-control-lg', className)}
      {...props}
    />
  );
}

export { Input };
