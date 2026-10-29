import { fmtTime } from '@/lib/format';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import type { PlaceScan } from '@/lib/types/database';

/**
 * A QR-locked checklist's scan log, one line per entry, oldest first:
 * "Scanned 07:12 by Ahmed", "Bad code at 07:10 by Ahmed", "Unlocked by Mona
 * at 08:00" — or "No scan yet". The round page and the daily report both
 * print it, so they always word it the same. Render it only for a checklist
 * with qr_required: one without the lock has nothing to scan.
 *
 * The time is the phone's (it may scan offline and sync later); an unlock's
 * is the server's. No hooks: server pages render it.
 */
export function ScanLog({
  scans,
  names,
  dict,
  locale,
  className,
}: {
  scans: PlaceScan[];
  names: Map<string, string>;
  dict: Dictionary;
  locale: Locale;
  className?: string;
}) {
  if (scans.length === 0) return <p className={`text-text/55 ${className ?? ''}`}>{dict.scanNone}</p>;
  const text = { scan: dict.scanScanned, bad_code: dict.scanBadCode, unlock: dict.scanUnlocked };
  return (
    <ul className={className}>
      {scans.map((s) => (
        <li key={s.id} className={s.kind === 'bad_code' ? 'text-magenta' : undefined}>
          {text[s.kind]
            .replace('{time}', fmtTime(s.scanned_at, locale))
            .replace('{name}', names.get(s.user_id) || dict.none)}
        </li>
      ))}
    </ul>
  );
}
