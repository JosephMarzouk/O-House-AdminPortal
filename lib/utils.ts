import { createCn } from 'cn/config';

/**
 * Class merging that knows the Broadsheet tokens.
 *
 * The stock merger only recognises Tailwind's default scales, so it read
 * `text-field` as a colour and dropped it in favour of `text-text/70` (both
 * "text-*"). Teaching it the custom text, radius, spacing and container names
 * from app/tokens.css keeps `text-end` overriding a cell's `text-start`,
 * `rounded-tile` overriding `rounded-card`, and so on. Add a name here when
 * you add one to tokens.css.
 */
export const cn = createCn({
  extend: {
    theme: {
      text: [
        'display',
        'heading',
        'title',
        'lg',
        'base',
        'sm',
        'xs',
        'label',
        'caption',
        'tag',
        'kicker',
        'brand',
        'field',
      ],
      radius: ['card', 'dialog', 'control', 'tile', 'header'],
      spacing: [
        'hairline',
        'focus',
        'tag-y',
        'icon-sm',
        'icon',
        'logo',
        'control',
        'control-lg',
        'thumb',
        'rail',
        'header',
        'sidebar',
      ],
      container: ['dialog'],
    },
  },
});
