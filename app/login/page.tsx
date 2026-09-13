import Image from 'next/image';
import { getDictionary } from '@/lib/i18n';
import { LoginForm } from '@/components/login-form';

/**
 * The one screen with its own grammar, and the one screen that is dark for
 * everybody.
 *
 * Every other page opens with a title block on paper and hugs the left,
 * because it sits beside the drawer and has content to read down. Sign-in has
 * neither, so it gets the system's only gradient and its only centred card —
 * the card carries the brand that the drawer carries everywhere else.
 *
 * data-theme="dark" is set here rather than inherited: the ground is a dark
 * gradient whichever theme the user picked, so a light card on it was the odd
 * one out. The palette block in app/tokens.css matches any subtree that opts
 * in, not just :root, so this one attribute re-skins the card, its inputs and
 * its text without touching what the user chose for the rest of the portal.
 */
export default async function LoginPage() {
  const dict = await getDictionary();

  return (
    // grid + place-items-center does the centring and needs no mx-auto, so it
    // mirrors under RTL for free. p-8 is the gutter that keeps the card off
    // the edge on a short viewport; the card then scrolls rather than clipping.
    // text-text is not redundant: <body> sets `color` once, outside this
    // subtree, so it resolves --color-text against the *root* theme and
    // inheritance carries that computed value in. Re-reading the token here is
    // what makes the scope actually take.
    <main
      data-theme="dark"
      className="grid min-h-dvh place-items-center bg-[image:var(--gradient-login)] p-8 text-text"
    >
      {/* raised, not surface: the panel floating above the gradient.
          rounded-tile is the system's "floats off the ground" radius, and
          shadow-lg its heaviest — this is a modal-weight surface. */}
      <div className="w-full max-w-dialog rounded-tile bg-raised p-8 shadow-lg shadow-(color:--color-shade)">
        {/* The brand block is centred and the mark leads it; the form below
            stays start-aligned, because its labels sit above their fields and
            centring those would break the reading line. */}
        <div className="text-center">
          {/* width/height are next/image's intrinsic size — the source is
              292×267, so passing its real ratio stops next/image squashing it.
              The rendered box is size-logo-lg from the tokens, and
              object-contain keeps the mark's own proportions inside it.
              No rounded-card: the artwork carries its own silhouette. */}
          <Image
            src="/owest.png"
            alt=""
            width={292}
            height={267}
            priority
            className="mx-auto size-logo-lg object-contain"
          />
          <h1 className="mt-4 text-title">{dict.appName}</h1>
          <p className="mt-1 text-base text-text/55">{dict.signIn}</p>
        </div>

        <div className="mt-8">
          <LoginForm dict={dict} />
        </div>
      </div>
    </main>
  );
}
