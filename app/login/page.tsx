import Image from 'next/image';
import { getDictionary } from '@/lib/i18n';
import { LoginForm } from '@/components/login-form';

export default async function LoginPage() {
  const dict = await getDictionary();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--ink)] p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image
            src="/owest.png"
            alt=""
            width={72}
            height={72}
            className="rounded-[var(--radius)]"
            priority
          />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--paper)]">{dict.appName}</h1>
            <p className="text-sm text-[var(--accent-300)]">{dict.appSubtitle}</p>
          </div>
        </div>

        <div className="bg-card p-6 shadow-[var(--shadow-broadsheet)]">
          <LoginForm dict={dict} />
        </div>
      </div>
    </main>
  );
}
