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
 *
 * `focus-within` rather than `focus` so this works whether the class sits on
 * the focusable element itself (Textarea, Select) or on a wrapper around it
 * (a prefixed Input). :focus-within matches the element itself too, so the
 * direct case is unchanged.
 */
export const fieldClass = cn(
  'w-full min-w-0 rounded-control border border-divider bg-surface px-4 text-base text-text',
  'transition-colors placeholder:text-text/65',
  'hover:border-text/45 focus-within:border-cyan focus-visible:outline-none',
  'disabled:cursor-not-allowed disabled:opacity-45',
  'aria-invalid:border-magenta',
);

/** The disabled/invalid states again, reached through a wrapper. A <span> is
 *  never :disabled itself, so the plain variants above are inert on one. These
 *  resolve to the same selectors — `:has(:disabled)` and
 *  `:has([aria-invalid="true"])` — so the two paths stay in step. */
const wrappedStateClass = cn(
  'has-disabled:cursor-not-allowed has-disabled:opacity-45',
  'has-aria-invalid:border-magenta',
);

function Input({
  className,
  compact,
  prefix,
  dir,
  ...props
}: Omit<React.ComponentProps<'input'>, 'prefix'> & {
  /** 44px instead of 56px — for filter rows and table cells, never a form proper. */
  compact?: boolean;
  /**
   * A fixed affix inside the field, before the value — a country code, a unit.
   * Decoration only: it never becomes part of the input's value.
   */
  prefix?: React.ReactNode;
}) {
  const height = compact ? 'h-control' : 'h-control-lg';

  if (prefix === undefined) {
    return (
      <InputPrimitive
        data-slot="input"
        dir={dir}
        className={cn(fieldClass, height, className)}
        {...props}
      />
    );
  }

  return (
    // The wrapper carries the field's whole look and the input inside is bare,
    // so the affix cannot be knocked out of alignment by a padding guess — the
    // same trick Select uses for its caret. `dir` lands here as well as on the
    // input, so the affix sits before the digits in both locales.
    <span
      dir={dir}
      className={cn(fieldClass, wrappedStateClass, height, 'flex items-center gap-1', className)}
    >
      <span aria-hidden className="shrink-0 select-none text-text/55">
        {prefix}
      </span>
      <InputPrimitive
        data-slot="input"
        dir={dir}
        className="h-full w-full min-w-0 border-0 bg-transparent p-0 text-base text-text outline-none placeholder:text-text/65 disabled:cursor-not-allowed"
        {...props}
      />
    </span>
  );
}

export { Input };
