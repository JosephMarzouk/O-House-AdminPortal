import { Skeleton } from '@/components/ui/skeleton';
import { PageBody } from '@/components/ui/page-header';

/** The report reads every checklist's items, history and photos, which takes
 *  seconds; this frame (same grammar as the report: title block, summary,
 *  overview table) shows the moment View is pressed. */
export default function Loading() {
  return (
    <>
      <div className="px-4 pt-6 md:px-8 md:pt-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-9 w-80 max-w-full" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <PageBody>
        <Skeleton className="h-20 max-w-sm" />
        <Skeleton className="h-64" />
      </PageBody>
    </>
  );
}
