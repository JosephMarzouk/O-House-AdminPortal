'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/actions/session';

/**
 * The sign-out sequence, in one place.
 *
 * The drawer row and the not-authorized screen both need it and they look
 * nothing alike, so what is shared is the behaviour, not a component — which
 * is why this is a hook and not another button.
 *
 * The server action revokes the refresh token at the API and drops both
 * cookies (they are httpOnly: the browser could not clear them itself).
 * refresh() before push(): the portal's pages are cached RSC payloads
 * rendered for a signed-in user, and without the refresh /login can render
 * against a stale one and bounce straight back in.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  return async () => {
    await signOut();
    router.refresh();
    router.push('/login');
  };
}
