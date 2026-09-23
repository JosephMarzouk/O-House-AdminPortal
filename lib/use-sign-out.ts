'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useClub } from '@/components/club-provider';

/**
 * The sign-out sequence, in one place.
 *
 * The drawer row and the not-authorized screen both need it and they look
 * nothing alike, so what is shared is the behaviour, not a component — which
 * is why this is a hook and not another button.
 *
 * refresh() before push(): the portal's pages are cached RSC payloads
 * rendered for a signed-in user, and without the refresh /login can render
 * against a stale one and bounce straight back in. If session teardown ever
 * needs a server round trip too, this is the only place that has to learn it.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  const club = useClub();
  return async () => {
    await createClient(club).auth.signOut();
    router.refresh();
    router.push('/login');
  };
}
