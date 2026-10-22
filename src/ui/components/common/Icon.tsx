// The game's own icons, drawn from the sprite sheets that `yarn icons` builds from src/ui/icons/: one for 20 pixels
// and under, with heavier lines and simpler drawings where an icon has one, and one for everything bigger.

import './Icon.css';

import type { ComponentChildren } from 'preact';

import type { IconId } from '../../../core/data';
import sprite from '../../icons/generated/sprite.svg?raw';
import spriteSmall from '../../icons/generated/sprite-small.svg?raw';
import type { IconLine } from '../../lib/icon-line';

let mounted = false;

/**
 * Put both sprite sheets on the page, once. They go inline rather than being linked to, as the desktop app loads the
 * game from a file, and a page loaded that way cannot draw from another file's symbols.
 */
function mountSprite() {
  if (mounted) return;
  mounted = true;
  document.body.insertAdjacentHTML('afterbegin', sprite + spriteSmall);
}

/** The size, in pixels, at and under which an icon draws from the small sheet. */
export const SMALL_SIZE = 20;

/**
 * Whether an icon this size draws from the small sheet: at 20 pixels or under, which a size given in ems (an icon
 * beside words, 15 to 18 pixels) always is, while one given as a share of its box is a big button's and is not.
 */
export const isSmall = (size: number | string) => (typeof size === 'number' ? size <= SMALL_SIZE : size.endsWith('em'));

/**
 * An icon, a square this many pixels across (or a length such as '1.25em', to match the words beside it), read out as
 * its label if it has one and passed over if not. At 20 pixels and under it is the icon's small form.
 */
export function Icon({
  id,
  size = 24,
  label,
  class: className,
}: {
  id: IconId;
  size?: number | string;
  label?: string;
  class?: string;
}) {
  mountSprite();
  return (
    <svg
      class={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <use href={`#icon-${isSmall(size) ? 'small-' : ''}${id}`} />
    </svg>
  );
}

/**
 * Words with an icon before them, the icon as tall as a capital and a little over, so it reads as part of the line;
 * just the words when there is no icon.
 */
export function IconText({
  id,
  children,
  class: className,
}: {
  id?: IconId | undefined;
  children: ComponentChildren;
  class?: string | undefined;
}) {
  if (!id) return className ? <span class={className}>{children}</span> : <>{children}</>;
  return (
    <span class={className ? `icon-text ${className}` : 'icon-text'}>
      <Icon id={id} size="1.3em" />
      <span>{children}</span>
    </span>
  );
}

/** A line of words with its icon, as the notes in ui/lib give them. */
export function Line({ line, class: className }: { line: IconLine; class?: string | undefined }) {
  return (
    <IconText id={line.icon} class={className}>
      {line.text}
    </IconText>
  );
}
