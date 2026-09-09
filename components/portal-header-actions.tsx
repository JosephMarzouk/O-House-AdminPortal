'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Languages, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { setLocale } from '@/lib/actions/locale';
import { Button } from '@/components/ui/button';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export function PortalHeaderActions({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => setLocale(locale === 'ar' ? 'en' : 'ar'))}
      >
        <Languages className="size-4" aria-hidden />
        {dict.language}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          await createClient().auth.signOut();
          router.refresh();
          router.push('/login');
        }}
      >
        <LogOut className="size-4" aria-hidden />
        {dict.signOut}
      </Button>
    </div>
  );
}
