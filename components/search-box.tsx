'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SearchIcon } from '@/components/icons';
import { Input } from '@/components/ui/input';

/**
 * The list screens' search field. The URL is the state (`?q=`), so the page —
 * a Server Component — does the filtering and a search survives a refresh or
 * a shared link, the same way the assignment filters work.
 *
 * Other params are read from window.location at the moment of writing rather
 * than through useSearchParams: that hook would force a Suspense boundary on
 * every page that renders this, and the page already knows the current value.
 */
export function SearchBox({ value, label }: { value?: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(value ?? '');

  useEffect(() => {
    // Debounced so typing a name is one navigation, not one per letter.
    const t = setTimeout(() => {
      const qs = new URLSearchParams(window.location.search);
      const q = text.trim();
      if ((qs.get('q') ?? '') === q) return;
      if (q) qs.set('q', q);
      else qs.delete('q');
      const s = qs.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [text, pathname, router]);

  return (
    <Input
      compact
      type="search"
      className="max-w-sm"
      prefix={<SearchIcon className="size-icon" />}
      aria-label={label}
      placeholder={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
    />
  );
}
