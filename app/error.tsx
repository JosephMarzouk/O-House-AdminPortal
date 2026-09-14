'use client';

import { Button } from '@/components/ui/button';

/**
 * The last stop for an unhandled server or render error.
 *
 * Without this file Next serves its own error page, which is unstyled, English
 * only, and — in a development build — prints the stack. The message here is
 * deliberately fixed and says nothing about what failed: `error.message` on a
 * thrown Postgres error carries table and constraint names, and this component
 * renders in the browser.
 *
 * Not translated through the dictionary: getDictionary() reads cookies on the
 * server, and if the failure that brought us here was in that path, calling it
 * again would loop. Both languages, plainly, is the honest way out.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper p-8 text-center">
      <h1 className="text-heading">حدث خطأ · Something went wrong</h1>
      <p className="max-w-prose text-base text-text/70">
        حاول مرة أخرى، وإذا استمر الخطأ أبلغ فريق التقنية.
        <br />
        Try again. If it keeps happening, tell the technical team.
      </p>
      <Button onClick={reset}>إعادة المحاولة · Try again</Button>
    </main>
  );
}
