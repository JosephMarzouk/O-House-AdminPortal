import { notFound } from 'next/navigation';
import {
  CameraIcon,
  StatusApprovedIcon,
  StatusPendingIcon,
  StatusRejectedIcon,
} from '@/components/icons';
import { getAssignment, doneCount } from '@/lib/db/assignments';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { fmtDate, fmtDateTime, fmtWindow } from '@/lib/format';
import { mediaUrl, mediaUrls } from '@/lib/media';
import { StatusBadge } from '@/components/status-badge';
import { ReviewBar } from '@/components/assignments/review-bar';
import { Card } from '@/components/ui/card';
import { BackLink, PageBody, PageHeader } from '@/components/ui/page-header';
import { Tag } from '@/components/ui/tag';
import type { AssignmentItem } from '@/lib/types/database';

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

  // A checklist item has three states; they borrow the assignment tones so
  // "done" reads as approved-cyan and "rejected" as magenta, same as the app.
  const itemTag = (item: AssignmentItem) =>
    item.status === 'done' ? (
      <Tag tone="approved" icon={<StatusApprovedIcon />}>
        {dict.itemDone}
      </Tag>
    ) : item.status === 'rejected' ? (
      <Tag tone="rejected" icon={<StatusRejectedIcon />}>
        {dict.itemRejected}
      </Tag>
    ) : (
      <Tag tone="pending" icon={<StatusPendingIcon />}>
        {dict.itemPending}
      </Tag>
    );

  return (
    <>
      <PageHeader
        kicker={<BackLink href="/assignments" label={dict.back} />}
        title={title || dict.none}
        // place · date · window — the same subtitle the app builds
        subtitle={[place, fmtDate(a.scheduled_date, locale), fmtWindow(a.window_start, a.window_end)]
          .filter(Boolean)
          .join(' · ')}
      >
        <StatusBadge status={a.effective_status} dict={dict} extended={a.was_extended} />
      </PageHeader>

      <PageBody>
        <dl className="flex flex-wrap gap-x-8 gap-y-4">
          <div>
            <dt className="section-label">{dict.assignee}</dt>
            <dd className="mt-1 text-lg">{a.inspector_name || dict.none}</dd>
          </div>
          <div>
            <dt className="section-label">{dict.deadline}</dt>
            <dd className="mt-1 text-lg">{fmtDateTime(a.deadline, locale)}</dd>
          </div>
          <div>
            <dt className="section-label">{dict.progress}</dt>
            <dd className="mt-1 text-lg tabular-nums">
              {doneCount(a.items)} / {a.items.length}
            </dd>
          </div>
        </dl>

        {a.review_note && (
          <p className="max-w-2xl rounded-card bg-magenta-tint px-3 py-2 text-sm text-magenta-deep">
            <span className="me-2 text-label uppercase">{dict.rejectReason}</span>
            {a.review_note}
          </p>
        )}

        <section>
          <h2 className="text-heading">{dict.subtasks}</h2>

          {a.items.length === 0 ? (
            // The legacy row has zero items and its checklist lives in the
            // deprecated submissions.answers jsonb instead.
            <p className="mt-4 text-text/55">{dict.noData}</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {a.items.map((item) => {
                const photos = mediaUrls(item.photo_paths);
                return (
                  <li key={item.id}>
                  <Card className="flex flex-wrap items-start gap-3">
                    {itemTag(item)}

                    <div className="min-w-0 flex-1 space-y-1">
                      <p className={item.critical ? 'font-semibold' : undefined}>
                        {bilingual(locale, item.text_ar, item.text_en) || dict.none}
                      </p>
                      {item.requires_photo && (
                        <p className="inline-flex items-center gap-1 text-caption text-text/55">
                          <CameraIcon className="size-icon-sm" />
                          {dict.requiresPhoto}
                        </p>
                      )}
                      {item.note && <p className="text-sm text-text/55">{item.note}</p>}
                      {item.reject_note && <p className="text-sm text-magenta">{item.reject_note}</p>}
                    </div>

                    {/* Photo evidence is permanent: view only, never a delete control. */}
                    {photos.length > 0 && (
                      <div className="flex gap-2">
                        {photos.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                            {/* Plain <img>: these are 5MB+ camera JPEGs from a
                                public bucket, and next/image would proxy every
                                one through the optimizer for a thumbnail. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={dict.photo}
                              loading="lazy"
                              className="size-thumb rounded-card object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {signature && (
          <section>
            <h2 className="text-heading">{dict.signature}</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signature}
              alt={dict.signature}
              className="mt-4 max-w-xs rounded-card bg-surface p-2"
            />
          </section>
        )}

        <ReviewBar
          assignmentId={a.id!}
          status={a.effective_status}
          items={a.items}
          dict={dict}
          locale={locale}
        />
      </PageBody>
    </>
  );
}
