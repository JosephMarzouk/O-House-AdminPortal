import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Camera } from 'lucide-react';
import { getAssignment, doneCount } from '@/lib/db/assignments';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { fmtDate, fmtDateTime, fmtWindow } from '@/lib/format';
import { mediaUrl, mediaUrls } from '@/lib/media';
import { StatusBadge } from '@/components/status-badge';

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [dict, locale, a] = await Promise.all([getDictionary(), getLocale(), getAssignment(id)]);
  if (!a) notFound();

  const title =
    bilingual(locale, a.title_ar, a.title_en) ||
    bilingual(locale, a.template_title_ar, a.template_title_en);
  const place = bilingual(locale, a.site_name_ar, a.site_name_en);
  const signature = mediaUrl(a.signature_url);

  return (
    <div className="space-y-6">
      <Link
        href="/assignments"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {dict.back}
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{title || '—'}</h1>
          <StatusBadge status={a.effective_status} dict={dict} extended={a.was_extended} />
        </div>
        {/* place · date · window — the same subtitle the app builds */}
        <p className="text-sm text-muted-foreground">
          {[place, fmtDate(a.scheduled_date, locale), fmtWindow(a.window_start, a.window_end)]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <dl className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
          <div>
            <dt className="section-label">{dict.assignee}</dt>
            <dd>{a.inspector_name || '—'}</dd>
          </div>
          <div>
            <dt className="section-label">{dict.deadline}</dt>
            <dd>{fmtDateTime(a.deadline, locale)}</dd>
          </div>
          <div>
            <dt className="section-label">{dict.progress}</dt>
            <dd className="tabular-nums">
              {doneCount(a.items)} / {a.items.length}
            </dd>
          </div>
        </dl>
        {a.review_note && (
          <p className="text-sm text-destructive">
            <span className="section-label me-2">{dict.rejectReason}</span>
            {a.review_note}
          </p>
        )}
      </header>

      <section className="space-y-2">
        <h2 className="section-label">{dict.subtasks}</h2>

        {a.items.length === 0 ? (
          // The legacy row has zero items and its checklist lives in the
          // deprecated submissions.answers jsonb instead.
          <p className="text-muted-foreground">{dict.noData}</p>
        ) : (
          <ul className="divide-y bg-card shadow-[var(--shadow-broadsheet)]">
            {a.items.map((item) => {
              const photos = mediaUrls(item.photo_paths);
              return (
                <li key={item.id} className="flex flex-wrap items-start gap-3 p-4">
                  <span
                    className={`status-badge status-${
                      item.status === 'done'
                        ? 'approved'
                        : item.status === 'rejected'
                          ? 'rejected'
                          : 'pending'
                    }`}
                  >
                    {item.status === 'done'
                      ? dict.itemDone
                      : item.status === 'rejected'
                        ? dict.itemRejected
                        : dict.itemPending}
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <p className={item.critical ? 'font-semibold' : undefined}>
                      {bilingual(locale, item.text_ar, item.text_en) || '—'}
                    </p>
                    {item.requires_photo && (
                      <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Camera className="size-3.5" aria-hidden />
                        {dict.requiresPhoto}
                      </p>
                    )}
                    {item.note && <p className="text-sm text-muted-foreground">{item.note}</p>}
                    {item.reject_note && (
                      <p className="text-sm text-destructive">{item.reject_note}</p>
                    )}
                  </div>

                  {photos.length > 0 && (
                    <div className="flex gap-2">
                      {photos.map((url) => (
                        // Plain <img>: these are 5MB+ camera JPEGs from a
                        // public bucket, and next/image would proxy every one
                        // through the optimizer for a thumbnail.
                        // eslint-disable-next-line @next/next/no-img-element
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={url}
                            alt={dict.photo}
                            loading="lazy"
                            className="size-16 object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {signature && (
        <section className="space-y-2">
          <h2 className="section-label">{dict.signature}</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signature}
            alt={dict.signature}
            className="max-w-xs bg-white p-2 shadow-[var(--shadow-broadsheet)]"
          />
        </section>
      )}
    </div>
  );
}
