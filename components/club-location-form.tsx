'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setClubLocation } from '@/lib/actions/club-pages';
import { mapsUrl, parseLocation, RADIUS_DEFAULT, RADIUS_MAX, RADIUS_MIN } from '@/lib/club-location';
import { errorMessage } from '@/lib/errors';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/** The club's zone, entered once. After saving the page shows it read-only. */
export function ClubLocationForm({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [coords, setCoords] = useState('');
  const [radius, setRadius] = useState(String(RADIUS_DEFAULT));
  const zone = parseLocation(coords, Number(radius));
  const invalid = coords.trim() !== '' && !zone;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await alert.confirm({
          title: dict.locationConfirmTitle,
          description: dict.locationConfirmBody,
          confirmLabel: dict.locationSave,
        });
        if (!ok) return;
        startTransition(async () => {
          const res = await setClubLocation(coords, Number(radius));
          if (res.ok) {
            alert.success(dict.saved);
            router.refresh();
          } else {
            alert.error(errorMessage(dict, res.error));
          }
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="club-coords">{dict.locationCoords}</Label>
        <Input
          id="club-coords"
          dir="ltr"
          placeholder="30.0444, 31.2357"
          aria-invalid={invalid || undefined}
          value={coords}
          onChange={(e) => setCoords(e.target.value)}
        />
        <p className={`text-caption ${invalid ? 'text-magenta' : 'text-text/55'}`}>
          {invalid ? dict.locationInvalid : dict.locationCoordsHint}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="club-radius">{dict.locationRadius}</Label>
        <Input
          id="club-radius"
          type="number"
          dir="ltr"
          className="w-40"
          inputMode="numeric"
          min={RADIUS_MIN}
          max={RADIUS_MAX}
          step={1}
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
        />
      </div>
      {zone && (
        <a
          className="inline-block text-cyan-dark hover:underline"
          href={mapsUrl(zone.lat, zone.lng)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {dict.locationOpenMap}
        </a>
      )}
      <div>
        <Button type="submit" disabled={pending || !zone}>
          {dict.locationSave}
        </Button>
      </div>
    </form>
  );
}
