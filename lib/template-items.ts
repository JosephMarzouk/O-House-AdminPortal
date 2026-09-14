import type { TemplateItem } from '@/lib/types/database';

/**
 * `templates.items` is jsonb with its shape documented only in a comment, so
 * parse defensively: a malformed row should cost one item, not the page.
 *
 * This is also the WRITE whitelist. savePlace runs its input through here
 * before storing, because a Server Action is an HTTP endpoint and the
 * TemplateItem[] annotation is gone at runtime — without it, any key a caller
 * invented would be persisted verbatim into a column the phone app reads.
 * Six fields in, six fields out, whatever arrived.
 *
 * Lives apart from lib/db/places.ts (which re-exports it, so no import site
 * changed) because that module pulls in the server Supabase client, and this
 * is a pure function that scripts/check.ts needs to import on its own.
 */
export function templateItems(items: unknown): TemplateItem[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw): TemplateItem[] => {
    if (!raw || typeof raw !== 'object') return [];
    const o = raw as Record<string, unknown>;
    return [
      {
        // `&& o.id`, not just the typeof: an empty string is a string. A new
        // subtask arrives from emptyItem() with id '', and savePlace now runs
        // its input through here — without the truthiness check every new item
        // would be stored with an id of '', several of them sharing it, which
        // is exactly the itemId stability this parser exists to protect.
        id: typeof o.id === 'string' && o.id ? o.id : crypto.randomUUID(),
        text_en: typeof o.text_en === 'string' ? o.text_en : '',
        text_ar: typeof o.text_ar === 'string' ? o.text_ar : '',
        type:
          o.type === 'pass_fail' || o.type === 'yesno' || o.type === 'text' || o.type === 'number'
            ? o.type
            : 'yesno',
        critical: o.critical === true,
        requires_photo: o.requires_photo === true,
      },
    ];
  });
}
