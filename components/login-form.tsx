'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Dictionary } from '@/lib/i18n/dictionaries';

export function LoginForm({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(dict.signInMissingFields);
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      // Never surface the raw GoTrue string — it distinguishes "no such user"
      // from "wrong password", which is an enumeration oracle.
      setError(dict.signInError);
      setLoading(false);
      return;
    }

    // refresh() so the server layout re-reads the session cookie the client
    // just wrote; push alone would render the old, signed-out tree.
    router.refresh();
    router.push('/');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-start">
      <div className="space-y-1.5">
        <Label htmlFor="email">{dict.email}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{dict.password}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? dict.loading : dict.signInButton}
      </Button>
    </form>
  );
}
