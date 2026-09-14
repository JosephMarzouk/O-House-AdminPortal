'use client';

import { useLinkStatus } from 'next/link';

/**
 * A dot that appears inside a <Link> while its navigation is in flight.
 *
 * The portal layout awaits getProfile() on every render, and Next's own
 * loading.js docs are explicit that a layout reading uncached runtime data
 * blocks navigation without showing its loading.tsx fallback at all. So
 * app/(portal)/loading.tsx never gets its turn and a screen change reads as
 * a frozen page — which is what makes people reload mid-navigation.
 *
 * useLinkStatus().pending covers exactly that window: true from the click
 * until history updates. When a navigation really is instant the hook is
 * skipped and nothing renders, which is the behaviour we want.
 *
 * Must be a descendant of <Link>. It is a client component, so server
 * components can drop it into a <Link> without going client themselves.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  // aria-hidden: the row already announces itself, and a screen reader user
  // is not the one about to hit reload.
  return <span aria-hidden className={pending ? 'link-hint is-pending' : 'link-hint'} />;
}
