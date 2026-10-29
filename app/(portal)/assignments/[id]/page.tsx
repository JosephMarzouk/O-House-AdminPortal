import { notFound } from 'next/navigation';
import {
  CameraIcon,
  StatusApprovedIcon,
  StatusFollowUpIcon,
  StatusPendingIcon,
  StatusRejectedIcon,
} from '@/components/icons';
import { getAssignment, doneCount, eventsFor, scansFor } from '@/lib/db/assignments';
import { listProfiles } from '@/lib/db/users';
import { can, getProfile } from '@/lib/auth';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { assigneeNames, fmtDateTime, fmtPeriod, fmtWindow } from '@/lib/format';
import { StatusTimeline } from '@/components/status-timeline';
import { answerLabel, correctLabel } from '@/lib/answers';
import { isVideo, roundMedia } from '@/lib/media';
import { listRefusals } from '@/lib/db/sync';
import { SyncRefusals } from '@/components/sync-refusals';
import { StatusBadge } from '@/components/status-badge';
import { ReviewBar } from '@/components/assignments/review-bar';
import { ScanLog } from '@/components/assignments/scan-log';
import { UnlockPlaceButton } from '@/components/assignments/unlock-place-button';
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
  const [dict, locale, a, media, refusals, events, profiles, me] = await Promise.all([
    getDictionary(),
    getLocale(),
    getAssignment(id),
    roundMedia(id),
    listRefusals({ assignmentId: id }),
    eventsFor([id]),
    listProfiles(),
    getProfile(),
  ]);
  if (!a) notFound();
  // QR-locked places: the scan log exists only for a checklist with the lock.
  const scans = a.qr_required ? ((await scansFor([id])).get(id) ?? []) : [];
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const several = (a.assignee_ids ?? []).length > 1;

  const title =
    bilingual(locale, a.title_ar, a.title_en) ||
    bilingual(locale, a.template_title_ar, a.template_title_en);
  const place = bilingual(locale, a.site_name_ar, a.site_name_en);
  const signature = media(a.signature_url);

  // A checklist item has four states; they borrow the assignment tones so
  // "done" reads as approved-cyan, "rejected" as solid magenta and a
  // follow-up as the magenta tint, same as the app.
  const itemTag = (item: AssignmentItem) =>
    item.status === 'done' ? (
      <Tag tone="approved" icon={<StatusApprovedIcon />}>
        {dict.itemDone}
      </Tag>
    ) : item.status === 'follow_up' ? (
      <Tag tone="follow_up" icon={<StatusFollowUpIcon />}>
        {dict.itemFollowUp}
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
        // round · place · date · window — the same subtitle the app builds
        subtitle={[
          bilingual(locale, a.round_title_ar, a.round_title_en),
          place,
          fmtPeriod(a.scheduled_date, a.end_date, locale),
          fmtWindow(a.window_start, a.window_end),
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        <StatusBadge status={a.effective_status} dict={dict} extended={a.was_extended} />
        {/* Done in time on the phone, but reached the server after the
            deadline (SY-11): not the staff member's lateness. */}
        {a.late_sync && <Tag tone="pending">{dict.lateSync}</Tag>}
      </PageHeader>

      <PageBody>
        <dl className="flex flex-wrap gap-x-8 gap-y-4">
          <div>
            <dt className="section-label">{several ? dict.assignedTo : dict.assignee}</dt>
            <dd className="mt-1 text-lg">{assigneeNames(a) || dict.none}</dd>
          </div>
          {/* Given to several: who took it (and so submits it), once someone has. */}
          {several && (
            <div>
              <dt className="section-label">{a.submitted_at ? dict.submittedBy : dict.takenBy}</dt>
              <dd className="mt-1 text-lg">
                {a.inspector_name || <span className="text-text/55">{dict.notStartedYet}</span>}
              </dd>
            </div>
          )}
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

        {a.task_note && (
          <p className="max-w-2xl rounded-card bg-surface px-3 py-2 text-sm">
            <span className="me-2 text-label uppercase">{dict.taskNote}</span>
            {a.task_note}
          </p>
        )}

        {a.submit_note && (
          <p className="max-w-2xl rounded-card bg-surface px-3 py-2 text-sm">
            <span className="me-2 text-label uppercase">{dict.submitNote}</span>
            {a.submit_note}
          </p>
        )}

        {a.review_note && (
          <p className="max-w-2xl rounded-card bg-magenta-tint px-3 py-2 text-sm text-magenta-deep">
            <span className="me-2 text-label uppercase">{dict.rejectReason}</span>
            {a.review_note}
          </p>
        )}

        {/* QR-locked places: who scanned, a bad code, a supervisor's unlock.
            Unlock is offered while it is locked and not yet handed in. */}
        {a.qr_required && (
          <section className="space-y-2">
            <h2 className="text-heading">{dict.placeScan}</h2>
            <ScanLog scans={scans} names={names} dict={dict} locale={locale} className="space-y-1 text-sm" />
            {!a.unlocked && a.effective_status !== 'submitted' && a.effective_status !== 'approved' && (
              <UnlockPlaceButton assignmentId={a.id!} may={can(me, 'assignments.unlock_place')} dict={dict} />
            )}
          </section>
        )}

        {refusals.length > 0 && (
          <SyncRefusals rows={refusals} dict={dict} locale={locale} showRound={false} />
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
                const photos = (item.photo_paths ?? [])
                  .map(media)
                  .filter((u): u is string => u !== null);
                const rule = correctLabel(item.type, item.correct, dict, locale);
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
                      {(item.answer || rule) && (
                        <p className="flex flex-wrap gap-x-4 text-sm">
                          {item.answer && (
                            <span>
                              <span className="text-text/55">{dict.answer}: </span>
                              <span className="font-semibold">
                                {answerLabel(item.type, item.answer, dict)}
                              </span>
                            </span>
                          )}
                          {rule && (
                            <span>
                              <span className="text-text/55">{dict.correctAnswer}: </span>
                              {rule}
                            </span>
                          )}
                        </p>
                      )}
                      {/* The first wrong answer stays after the fix — the one
                          record that a problem was found and when. */}
                      {item.flagged_answer && (
                        <p className="text-sm text-magenta-deep">
                          <span className="rounded-card bg-magenta-tint px-2 py-tag-y">
                            {dict.flaggedAnswer.replace(
                              '{answer}',
                              answerLabel(item.type, item.flagged_answer, dict),
                            )}{' '}
                            · {fmtDateTime(item.flagged_at, locale)}
                          </span>
                        </p>
                      )}
                      {item.note && <p className="text-sm text-text/55">{item.note}</p>}
                      {item.reject_note && <p className="text-sm text-magenta">{item.reject_note}</p>}
                    </div>

                    {/* Photo evidence is permanent: view only, never a delete control. */}
                    {photos.length > 0 && (
                      <div className="flex gap-2">
                        {photos.map((url) =>
                          // A camera clip (the app's "Record a video"). The
                          // signed link keeps the stored .mp4 path.
                          isVideo(url) ? (
                            <video
                              key={url}
                              src={url}
                              controls
                              preload="metadata"
                              className="h-thumb max-w-64 rounded-card bg-ink"
                            />
                          ) : (
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
                          ),
                        )}
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

        <section>
          <h2 className="text-heading">{dict.timeline}</h2>
          <div className="mt-4">
            <StatusTimeline events={events.get(id) ?? []} names={names} dict={dict} locale={locale} />
          </div>
        </section>

        <ReviewBar
          assignmentId={a.id!}
          status={a.effective_status}
          items={a.items}
          mayReview={can(me, 'review.edit')}
          mayExtend={can(me, 'checklists.edit')}
          dict={dict}
          locale={locale}
        />
      </PageBody>
    </>
  );
}
