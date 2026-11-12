'use client';

import { useState } from 'react';
import { CaretLeftIcon, CaretRightIcon, OpenExternalIcon, PlayIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { fmtNum } from '@/lib/format';
import { isVideo } from '@/lib/evidence';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

/**
 * One sub-task's evidence: square thumbnails, photos and camera clips alike,
 * each opening a large viewer with previous / next across the item's media.
 * A clip's thumbnail is its first frame (a muted, control-less <video>; the
 * API sends no poster) under a play mark, so the whole tile is one easy target
 * instead of a native player squeezed into 64px.
 *
 * Evidence is permanent: view only, never a delete control.
 */
export function EvidenceGallery({ urls, dict, locale }: { urls: string[]; dict: Dictionary; locale: Locale }) {
  const [open, setOpen] = useState<number | null>(null);
  const current = open === null ? null : urls[open];

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => {
          const video = isVideo(url);
          return (
            <button
              key={url}
              type="button"
              aria-label={video ? dict.playVideo : dict.openPhoto}
              onClick={() => setOpen(i)}
              className="relative size-thumb shrink-0 cursor-pointer overflow-hidden rounded-card bg-ink outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            >
              {video ? (
                <>
                  {/* #t=0.1: some browsers paint nothing for frame 0 of a phone clip. */}
                  <video
                    src={`${url}#t=0.1`}
                    muted
                    playsInline
                    preload="metadata"
                    className="pointer-events-none size-full object-cover"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-neutral-900/35">
                    <PlayIcon className="size-icon text-white" />
                  </span>
                </>
              ) : (
                // Plain <img>: 5MB+ camera JPEGs; next/image would proxy every
                // one through the optimizer for a thumbnail.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" loading="lazy" className="size-full object-cover" />
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent closeLabel={dict.close} className="max-w-4xl gap-3 p-3 pt-12">
          {current && open !== null && (
            <>
              <DialogTitle className="sr-only">
                {isVideo(current) ? dict.video : dict.photo} {fmtNum(open + 1, locale)} / {fmtNum(urls.length, locale)}
              </DialogTitle>
              <div className="grid min-h-64 place-items-center overflow-hidden rounded-card bg-ink">
                {isVideo(current) ? (
                  <video
                    key={current}
                    src={current}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[75vh] w-full"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={current} src={current} alt={dict.photo} className="max-h-[75vh] w-auto object-contain" />
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={dict.previous}
                    disabled={open === 0}
                    onClick={() => setOpen(open - 1)}
                  >
                    <CaretLeftIcon className="rtl:-scale-x-100" />
                  </Button>
                  <span className="text-sm tabular-nums text-text/55">
                    {fmtNum(open + 1, locale)} / {fmtNum(urls.length, locale)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={dict.next}
                    disabled={open === urls.length - 1}
                    onClick={() => setOpen(open + 1)}
                  >
                    <CaretRightIcon className="rtl:-scale-x-100" />
                  </Button>
                </div>
                <a
                  href={current}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-control items-center gap-1 text-sm text-cyan-dark hover:underline"
                >
                  <OpenExternalIcon className="size-icon-sm" />
                  {dict.openInNewTab}
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
