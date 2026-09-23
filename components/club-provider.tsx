'use client';

import { createContext, useContext } from 'react';
import type { PublicClub } from '@/lib/club-registry';

/**
 * The request's club, resolved on the server (lib/club.ts) and handed to the
 * browser once, from the root layout. Only public fields: the publishable key
 * is meant to be public, and nothing secret ever reaches this context.
 */
const ClubContext = createContext<PublicClub | null>(null);

export function ClubProvider({ club, children }: { club: PublicClub; children: React.ReactNode }) {
  return <ClubContext.Provider value={club}>{children}</ClubContext.Provider>;
}

export function useClub(): PublicClub {
  const club = useContext(ClubContext);
  if (!club) throw new Error('useClub() outside <ClubProvider>');
  return club;
}
