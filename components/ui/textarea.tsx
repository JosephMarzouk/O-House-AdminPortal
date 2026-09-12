import * as React from 'react';
import { fieldClass } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      // field-sizing-content lets the box grow with the note instead of
      // showing a scrollbar inside a 56px pill.
      className={cn(fieldClass, 'field-sizing-content min-h-control-lg py-3', className)}
      {...props}
    />
  );
}

export { Textarea };
