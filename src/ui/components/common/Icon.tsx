// The game's own icons, drawn from the sprite sheet that `yarn icons` builds from src/ui/icons/.

import './Icon.css';

import type { ComponentChildren } from 'preact';

import type { IconId } from '../../../core/data';
import sprite from '../../icons/generated/sprite.svg?raw';
import type { IconLine } from '../../lib/icon-line';

let mounted = false;

/**
 * Put the sprite sheet on the page, once. It goes inline rather than being linked to, as the desktop app loads the
 * game from a file, and a page loaded that way cannot draw from another file's symbols.
 */
function mountSprite() {
  if (mounted) return;
  mounted = true;
  document.body.insertAdjacentHTML('afterbegin', sprite);
}

/**
 * An icon, a square this many pixels across (or a length such as '1.25em', to match the words beside it), read out as
 * its label if it has one and passed over if not.
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
      <use href={`#icon-${id}`} />
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
