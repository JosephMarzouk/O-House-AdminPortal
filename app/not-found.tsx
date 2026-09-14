import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

/**
 * Reached by notFound() — places/[id] already calls it — and by any URL that
 * matches no route. Bilingual for the same reason as error.tsx: this renders
 * outside the portal layout, so there is no dictionary in scope.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper p-8 text-center">
      <h1 className="text-heading">الصفحة غير موجودة · Page not found</h1>
      <Link href="/" className={buttonVariants({ variant: 'outline' })}>
        العودة إلى لوحة التحكم · Back to the dashboard
      </Link>
    </main>
  );
}
