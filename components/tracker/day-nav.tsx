'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CaretLeftIcon, CaretRightIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addDays } from '@/lib/format';

/**
 * Which day the tracker shows: a step back, today, a step forward, or any date
 * from the native picker. The day lives in the URL (?date=), so a board can be
 * bookmarked or sent to someone as it stands.
 */
export function DayNav({
  day,
  today,
  labels,
}: {
  day: string;
  today: string;
  labels: { prev: string; next: string; today: string; date: string };
}) {
  const router = useRouter();
  const href = (d: string) => (d === today ? '/tracker' : `/tracker?date=${d}`);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={labels.prev}
        nativeButton={false}
        render={<Link href={href(addDays(day, -1))} scroll={false} />}
      >
        <CaretLeftIcon className="rtl:-scale-x-100" />
      </Button>
      <Button
        variant={day === today ? 'outline' : 'ghost'}
        nativeButton={false}
        render={<Link href="/tracker" scroll={false} />}
      >
        {labels.today}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={labels.next}
        nativeButton={false}
        render={<Link href={href(addDays(day, 1))} scroll={false} />}
      >
        <CaretRightIcon className="rtl:-scale-x-100" />
      </Button>
      <Input
        compact
        type="date"
        dir="ltr"
        className="w-44"
        aria-label={labels.date}
        value={day}
        onChange={(e) => e.target.value && router.push(href(e.target.value), { scroll: false })}
      />
    </div>
  );
}
