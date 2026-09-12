import { Skeleton } from '@/components/ui/skeleton';
import { PageBody } from '@/components/ui/page-header';

/** `/` went from an instant redirect to several round trips, so the segment
 *  streams a frame instead of holding a blank screen. The frame is the same
 *  grammar as the page: ink block, then tiles, then sections. */
export default function Loading() {
  return (
    <>
      <div className="min-h-header rounded-b-header bg-ink" />
      <PageBody>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-tile" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </PageBody>
    </>
  );
}
