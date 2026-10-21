// The game's own icons, drawn from the sprite sheet that `yarn icons` builds from src/ui/icons/.

import './Icon.css';

import type { IconId } from '../../../core/data';
import sprite from '../../icons/generated/sprite.svg?raw';

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

/** An icon, a square this many pixels across, read out as its label if it has one and passed over if not. */
export function Icon({
  id,
  size = 24,
  label,
  class: className,
}: {
  id: IconId;
  size?: number;
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
