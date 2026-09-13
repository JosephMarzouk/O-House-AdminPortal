'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';
import {
  InfoIcon,
  SpinnerIcon,
  StatusApprovedIcon,
  StatusRejectedIcon,
  WarningIcon,
} from '@/components/icons';

/** Toasts on the surface fill, in the serif, with Phosphor icons. Light only —
 *  there is no theme to read. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <StatusApprovedIcon className="size-icon" />,
        info: <InfoIcon className="size-icon" />,
        warning: <WarningIcon className="size-icon" />,
        error: <StatusRejectedIcon className="size-icon" />,
        loading: <SpinnerIcon className="size-icon animate-spin" />,
      }}
      style={
        {
          fontFamily: 'var(--font-ui)',
          '--normal-bg': 'var(--color-surface)',
          '--normal-text': 'var(--color-text)',
          '--normal-border': 'var(--color-divider)',
          '--border-radius': 'var(--radius-card)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
