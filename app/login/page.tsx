import { getDictionary } from '@/lib/i18n';
import { LoginForm } from '@/components/login-form';
import { PageBody, PageHeader } from '@/components/ui/page-header';

/** Same grammar as every other page: the ink block up top, the form on the
 *  paper below it, hugging the left. Nothing is centred. */
export default async function LoginPage() {
  const dict = await getDictionary();

  return (
    <main className="min-h-dvh">
      <PageHeader kicker={dict.appSubtitle} title={dict.appName} subtitle={dict.signIn} />
      <PageBody>
        <div className="max-w-md">
          <LoginForm dict={dict} />
        </div>
      </PageBody>
    </main>
  );
}
