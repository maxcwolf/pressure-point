// The list of mouse and keyboard controls.

import { loadControls } from '../../../storage/controls';
import { css } from '../../../styled-system/css';
import { cx } from '../../lib/cx';
import { keyLabel } from '../../lib/keys';

/**
 * The controls, a line each, with every key drawn as a keycap: white, outlined in navy, deeper along the bottom.
 * `keys` is for the end-to-end tests to find it by.
 */
const keyList = css({
  listStyle: 'none',
  p: 'none',
  textAlign: 'left',
  fontSize: 'body',
  lineHeight: '[1.9]',
  '& kbd': {
    font: 'inherit',
    fontSize: '[12px]',
    fontWeight: 'bold',
    bg: 'white',
    border: 'control',
    borderBottomWidth: '[3.5px]',
    borderRadius: '[7px]',
    p: '[1px 7px]',
  },
});

/** How to play, shown in the pause menu, with the keys as they are set in the settings. */
export function Controls() {
  const { keys, edgeScroll } = loadControls();
  /** A key as printed on it. */
  const k = (code: string) => <kbd>{keyLabel(code)}</kbd>;
  return (
    <ul class={cx('keys', keyList)}>
      <li>
        <kbd>Left click</kbd> select, place, confirm
      </li>{' '}
      <li>
        <kbd>Drag</kbd>
        {edgeScroll ? ', the screen edge' : ''} or {k(keys.up)} {k(keys.left)} {k(keys.down)} {k(keys.right)} move the
        camera
      </li>{' '}
      <li>
        <kbd>Scroll</kbd> zoom · {k(keys.turnLeft)} {k(keys.turnRight)} turn the camera
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
