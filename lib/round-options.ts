import { templateCategories, templateItems } from '@/lib/template-items';
import type { Category, Template } from '@/lib/types/database';

export type RoundPlaceOption = {
  id: string;
  nameAr: string;
  nameEn: string;
  /** No site twin, or no subtasks: schedule_rounds() would skip it. */
  schedulable: boolean;
  itemCount: number;
  /** The place's categories, for the round's per-place ticks (19 Nov). */
  categories: Category[];
  /** Each question's category, enough to count what a round entry keeps. */
  items: { category_id?: string }[];
};

/**
 * Places in the shape the round editor's picker wants. `schedulable` is the
 * same test schedule_rounds() applies before creating a task: a site twin to
 * put on the assignment, and at least one subtask — a 0/0 task would sit on
 * the phone with Submit permanently disabled.
 */
export function toRoundPlaceOptions(places: Template[]): RoundPlaceOption[] {
  return places.map((p) => {
    const categories = templateCategories(p.categories);
    const items = templateItems(p.items, categories);
    const itemCount = items.length;
    return {
      id: p.id,
      nameAr: p.title_ar,
      nameEn: p.title_en,
      schedulable: !!p.site_id && itemCount > 0,
      itemCount,
      categories,
      items: items.map((i) => (i.category_id ? { category_id: i.category_id } : {})),
    };
  });
}
