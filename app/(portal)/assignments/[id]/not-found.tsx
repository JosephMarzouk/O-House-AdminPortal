import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

/**
 * Reached by notFound() on /assignments/<id>: the checklist does not exist, or
 * the database's read rules (RLS) hide it from this person. The two look the
 * same on purpose. Bilingual text, like the app-level not-found page.
 */
export default function AssignmentNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-heading">لم يتم العثور على القائمة أو ليس لديك صلاحية لعرضها</h1>
      <p className="text-sm">This checklist was not found, or you don&apos;t have access to it.</p>
      <Link href="/assignments" className={buttonVariants({ variant: 'outline' })}>
        العودة إلى المهام · Back to Assignments
      </Link>
    </div>
  );
}
