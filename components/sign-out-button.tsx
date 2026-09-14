'use client';

import { SignOutIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useSignOut } from '@/lib/use-sign-out';

/** Standalone sign-out for the not-authorized screen, which renders outside
 *  the sidebar — a cleaner or inspector who reaches the portal needs a way
 *  back out. */
export function SignOutButton({ label }: { label: string }) {
  const signOut = useSignOut();
  return (
    <Button variant="outline" onClick={signOut}>
      <SignOutIcon />
      {label}
    </Button>
  );
}
