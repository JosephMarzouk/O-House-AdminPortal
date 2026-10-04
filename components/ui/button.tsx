import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Broadsheet button. Serif semibold label, 16px radius (the staff app's one
 * deliberate departure from "2px everywhere"), 44px minimum height and 56px
 * for a primary — a primary is the page's one big action and gets the room.
 *
 * Four variants, and only `destructive` may wear magenta: everything else is
 * cyan or transparent. There is no "secondary filled" — Broadsheet has one
 * accent and one filled button per view.
 */
const buttonVariants = cva(
  cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-control px-4',
    'text-base font-semibold whitespace-nowrap select-none transition-colors',
    'disabled:pointer-events-none disabled:opacity-45',
    '[&_svg]:pointer-events-none [&_svg]:size-icon [&_svg]:shrink-0',
  ),
  {
    variants: {
      variant: {
        primary: 'bg-cyan text-on-cyan hover:bg-accent-600 active:bg-accent-700',
        outline:
          'border border-divider bg-transparent text-cyan-dark hover:bg-text/7 active:bg-text/14',
        ghost: 'bg-transparent text-cyan-dark hover:bg-cyan/10 active:bg-cyan/20',
        destructive: 'bg-accent2-700 text-on-brand hover:bg-accent2-800 active:bg-accent2-900',
      },
      size: {
        md: 'h-control',
        lg: 'h-control-lg px-6',
        icon: 'size-control px-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

function Button({
  className,
  variant = 'primary',
  size,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  // Primaries default to the 56px height; everything else to 44px.
  const resolvedSize = size ?? (variant === 'primary' ? 'lg' : 'md');
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size: resolvedSize }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
