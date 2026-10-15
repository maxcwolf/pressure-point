// The list of mouse and keyboard controls.

import './Controls.css';

import { loadControls } from '../../../storage/controls';
import { keyLabel } from '../../lib/keys';

/** How to play, shown in the pause menu, with the keys as they are set in the settings. */
export function Controls() {
  const { keys, edgeScroll } = loadControls();
  /** A key as printed on it. */
  const k = (code: string) => <kbd>{keyLabel(code)}</kbd>;
  return (
    <ul class="keys">
      <li>
        <kbd>Left click</kbd> select, place, confirm
      </li>{' '}
      <li>
        <kbd>Drag</kbd>
        {edgeScroll ? ', the screen edge' : ''} or {k(keys.up)} {k(keys.left)} {k(keys.down)} {k(keys.right)} move the
        camera
      </li>{' '}
      <li>
        <kbd>Scroll</kbd> zoom
      </li>{' '}
      <li>
        {k(keys.rotate)} rotate furniture · <kbd>Esc</kbd> / right click cancel · <kbd>Esc</kbd> again for this menu
      </li>{' '}
      <li>
        {k(keys.pause)} pause · {k(keys.speed1)} {k(keys.speed2)} {k(keys.speed3)} game speed
      </li>
    </ul>
  );
}
