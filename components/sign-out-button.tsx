'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

/** Standalone sign-out for the not-authorized screen, which renders outside
 *  the sidebar — a cleaner or inspector who reaches the portal needs a way
 *  back out. */
export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await createClient().auth.signOut();
        router.refresh();
        router.push('/login');
      }}
    >
      <LogOut className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
