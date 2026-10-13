// The list of mouse and keyboard controls.

import './Controls.css';

/** How to play, shown in the pause menu. */
export function Controls() {
  return (
    <ul class="keys">
      <li>
        <kbd>Left click</kbd> select, place, confirm
      </li>{' '}
      <li>
        <kbd>Drag</kbd> or <kbd>W A S D</kbd> move the camera
      </li>{' '}
      <li>
        <kbd>Scroll</kbd> zoom
      </li>{' '}
      <li>
        <kbd>R</kbd> rotate furniture · <kbd>Esc</kbd> / right click cancel · <kbd>Esc</kbd> again for this menu
      </li>{' '}
      <li>
        <kbd>Space</kbd> pause · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> game speed
      </li>
    </ul>
  );
}
