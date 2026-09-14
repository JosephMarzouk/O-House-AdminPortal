'use client';

import * as React from 'react';
import { useId, useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@/components/icons';
import { Input } from '@/components/ui/input';

/**
 * A password field an admin can read back before committing it.
 *
 * The toggle is a real <button> in the field's suffix slot rather than an icon
 * with a click handler, so it is reachable by keyboard and announces its state;
 * aria-pressed carries that state, and the label flips with it because "Show
 * password" on a field already showing one is a lie.
 *
 * Revealing is always transient — the field is remounted as type="password"
 * wherever it is reset, so a value never survives visible into the next use.
 *
 * `autoComplete="new-password"` on every instance: these fields set *someone
 * else's* password, so a browser offering the admin's own saved credential is
 * at best noise and at worst the wrong password silently submitted.
 */
export function PasswordInput({
  showLabel,
  hideLabel,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'type' | 'suffix'> & {
  showLabel: string;
  hideLabel: string;
}) {
  const [shown, setShown] = useState(false);
  const fallbackId = useId();
  const id = props.id ?? fallbackId;

  return (
    <Input
      {...props}
      id={id}
      type={shown ? 'text' : 'password'}
      dir="ltr"
      autoComplete="new-password"
      suffix={
        <button
          type="button"
          aria-label={shown ? hideLabel : showLabel}
          aria-pressed={shown}
          aria-controls={id}
          // -me-4 cancels the field's own px-4 so the 44px hit area sits flush
          // to the field edge rather than floating a padding's width inside it.
          className="-me-4 grid size-control place-items-center rounded-control text-text/60 transition-colors hover:text-text"
          onClick={() => setShown((v) => !v)}
        >
          {shown ? <EyeSlashIcon className="size-icon" /> : <EyeIcon className="size-icon" />}
        </button>
      }
    />
  );
}
