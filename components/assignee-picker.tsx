'use client';

import { Menu } from '@base-ui/react/menu';
import { CaretDownIcon, CheckIcon } from '@/components/icons';
import { fieldClass } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type PickerStaff = { id: string; name: string };

/**
 * Pick one or more people for a task. With several, whoever acts first on
 * the phone claims the task (private.claim_assignment); the others lose it.
 *
 * A menu of checkboxes rather than a native <select multiple>: that renders
 * as an always-open list box, which does not fit a planner cell. The menu
 * stays open while ticking, so several names are one open, not one each.
 */
export function AssigneePicker({
  staff,
  value,
  onChange,
  placeholder,
  label,
  compact,
  disabled,
  invalid,
  changed,
  className,
  id,
}: {
  staff: PickerStaff[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Shown when nobody is picked. */
  placeholder: string;
  /** The accessible name, when no visible <label> points at the trigger. */
  label?: string;
  compact?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** The planner marks an edited cell with a cyan border. */
  changed?: boolean;
  className?: string;
  id?: string;
}) {
  const picked = new Set(value);
  const names = staff.filter((s) => picked.has(s.id)).map((s) => s.name);
  // A person no longer in the list (deactivated) still counts, so the
  // trigger never claims a cell is emptier than it is.
  const unknown = value.length - names.length;
  const summary =
    names.length === 0 && unknown === 0
      ? placeholder
      : [...names, ...(unknown > 0 ? [`+${unknown}`] : [])].join(' · ');

  return (
    <Menu.Root>
      <Menu.Trigger
        id={id}
        aria-label={label}
        aria-invalid={invalid}
        disabled={disabled}
        className={cn(
          fieldClass,
          compact ? 'h-control' : 'h-control-lg',
          'flex items-center gap-2 text-start',
          changed && 'border-cyan',
          className,
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', value.length === 0 && 'text-text/65')}>
          {summary}
        </span>
        <CaretDownIcon className="size-icon-sm shrink-0 text-text/55" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="start" className="z-50">
          <Menu.Popup className="max-h-80 min-w-56 overflow-y-auto rounded-dialog bg-raised p-1 text-text shadow-lg shadow-(color:--color-shade) outline-none">
            {staff.map((s) => (
              <Menu.CheckboxItem
                key={s.id}
                closeOnClick={false}
                checked={picked.has(s.id)}
                onCheckedChange={(on) =>
                  onChange(on ? [...value, s.id] : value.filter((v) => v !== s.id))
                }
                className="group flex min-h-control cursor-pointer items-center gap-3 rounded-control px-3 text-sm outline-none data-highlighted:bg-text/7"
              >
                <span className="flex size-4 shrink-0 items-center justify-center rounded-card border border-divider bg-surface group-data-checked:border-cyan group-data-checked:bg-cyan group-data-checked:text-on-brand">
                  <Menu.CheckboxItemIndicator>
                    <CheckIcon weight="bold" className="size-icon-sm" />
                  </Menu.CheckboxItemIndicator>
                </span>
                {s.name}
              </Menu.CheckboxItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
