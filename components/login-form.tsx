'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { toLoginCredential } from '@/lib/phone';
import type { Dictionary } from '@/lib/i18n/dictionaries';

export function LoginForm({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const typed = identifier.trim();
    if (!typed || !password) {
      setError(dict.signInMissingFields);
      return;
    }
    setLoading(true);
    setError(null);

    // Staff type a phone, admins and managers an email; GoTrue only ever
    // holds an email, so toLoginCredential rebuilds the phone into the same
    // synthetic address the Flutter app builds. See lib/phone.ts for why
    // the '@' test in there is not optional.
    const credential = toLoginCredential(typed);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: credential,
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
      <div className="space-y-1">
        <Label htmlFor="identifier">{dict.signInIdentifier}</Label>
        {/* type="text", not "email": the browser's own email validation
            would reject a phone number before onSubmit ever ran. */}
        <Input
          id="identifier"
          type="text"
          autoComplete="username"
          dir="ltr"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <p className="text-caption text-text/55">{dict.signInIdentifierHint}</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="password">{dict.password}</Label>
        {/* The same field the Users screen uses, so the reveal toggle behaves
            and announces itself identically in both places. autoComplete is
            the one difference: here the browser SHOULD offer the saved
            credential, because this password is the reader's own. */}
        <PasswordInput
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          showLabel={dict.showPassword}
          hideLabel={dict.hidePassword}
        />
      </div>

      {error && (
        <p className="rounded-card bg-magenta-tint px-3 py-2 text-sm text-magenta-deep" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? dict.loading : dict.signInButton}
      </Button>
    </form>
  );
}
