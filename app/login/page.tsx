import Image from 'next/image';
import { getDictionary } from '@/lib/i18n';
import { LoginForm } from '@/components/login-form';

/**
 * The one screen with its own grammar.
 *
 * Every other page opens with a title block on paper and hugs the left,
 * because it sits beside the drawer and has content to read down. Sign-in has
 * neither, so it gets the system's only gradient and its only centred card —
 * the card carries the brand that the drawer carries everywhere else.
 */
export default async function LoginPage() {
  const dict = await getDictionary();

  return (
    // grid + place-items-center does the centring and needs no mx-auto, so it
    // mirrors under RTL for free. p-8 is the gutter that keeps the card off
    // the edge on a short viewport; the card then scrolls rather than clipping.
    <main className="grid min-h-dvh place-items-center bg-[image:var(--gradient-login)] p-8">
      {/* paper, not surface: the page ground floating above the gradient.
          rounded-tile is the system's "floats off the paper" radius, and
          shadow-lg its heaviest — this is a modal-weight surface. */}
      <div className="w-full max-w-dialog rounded-tile bg-paper p-8 shadow-lg">
        <Image
          src="/owest.png"
          alt=""
          width={32}
          height={32}
          priority
          className="size-logo rounded-card"
        />
        <h1 className="mt-4 text-display">{dict.appName}</h1>
        <p className="mt-1 text-lg text-text/55">{dict.signIn}</p>

        <div className="mt-8">
          <LoginForm dict={dict} />
        </div>
      </div>
    </main>
  );
}
