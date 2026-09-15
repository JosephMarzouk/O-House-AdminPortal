'use client';

import { useSyncExternalStore } from 'react';
import { StatusApprovedIcon, StatusRejectedIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * The portal's one alert surface.
 *
 * Every mutation result and every irreversible-action gate now renders the
 * dialog the password reset already used: surface ground over a blurred,
 * ink-tinted page, actions at the end of the footer. It replaces two other
 * voices that were saying the same things differently — sonner toasts, and
 * the browser's native confirm() on the delete button.
 *
 * The API is imperative and module-level rather than a context, which is why
 * it can be called from inside a startTransition callback and why the call
 * sites read the way the toast calls they replaced did. <AlertHost /> is
 * mounted once in the root layout; there is nothing to wrap.
 */

type Alert =
  | { kind: 'result'; tone: 'success' | 'error'; message: string }
  | {
      kind: 'confirm';
      title: string;
      description?: string;
      confirmLabel: string;
      destructive: boolean;
      resolve: (ok: boolean) => void;
    };

// ponytail: one slot, last call wins — no queue. Nothing in the portal raises
// two alerts at once: a result follows a confirmation only after the first has
// resolved and closed. Add a queue if that stops being true.
let current: Alert | null = null;
const listeners = new Set<() => void>();

function set(next: Alert | null) {
  current = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * Dismissing a confirm — Escape, the backdrop, Cancel, the corner X — has to
 * answer the promise, or the caller waits for ever. Every close path funnels
 * through here for that reason.
 */
function close() {
  if (current?.kind === 'confirm') current.resolve(false);
  set(null);
}

export const alert = {
  success(message: string) {
    set({ kind: 'result', tone: 'success', message });
  },
  error(message: string) {
    set({ kind: 'result', tone: 'error', message });
  },
  confirm(opts: {
    title: string;
    description?: string;
    confirmLabel: string;
    destructive?: boolean;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      set({
        kind: 'confirm',
        title: opts.title,
        description: opts.description,
        confirmLabel: opts.confirmLabel,
        destructive: opts.destructive ?? false,
        resolve,
      });
    });
  },
};

export function AlertHost({ labels }: { labels: { ok: string; cancel: string } }) {
  // Server render has no alert open, which is also the client's first state —
  // so the two agree and nothing hydrates twice.
  const state = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent closeLabel={state?.kind === 'confirm' ? labels.cancel : labels.ok}>
        {state?.kind === 'result' && (
          <>
            <DialogHeader>
              {/* The message is the title: Base UI names the dialog from it,
                  and it is how the password dialog names itself too. */}
              <DialogTitle className="flex items-start gap-3">
                {state.tone === 'success' ? (
                  <StatusApprovedIcon className="mt-0.5 size-icon shrink-0 text-cyan" />
                ) : (
                  <StatusRejectedIcon className="mt-0.5 size-icon shrink-0 text-magenta" />
                )}
                <span className="min-w-0">{state.message}</span>
              </DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <Button size="md" onClick={close}>
                {labels.ok}
              </Button>
            </DialogFooter>
          </>
        )}

        {state?.kind === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>{state.title}</DialogTitle>
              {state.description && <DialogDescription>{state.description}</DialogDescription>}
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={close}>
                {labels.cancel}
              </Button>
              <Button
                variant={state.destructive ? 'destructive' : 'primary'}
                size="md"
                onClick={() => {
                  state.resolve(true);
                  set(null);
                }}
              >
                {state.confirmLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
