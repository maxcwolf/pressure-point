// The frame every dialog sits in.

import './Dialog.css';

import type { ComponentChildren } from 'preact';

import { cx } from '../../lib/cx';
import { ScrollTab } from '../common/ScrollTab';

/** A panel over the game, with the game dimmed behind it. */
export function Dialog({ wide = false, children }: { wide?: boolean; children: ComponentChildren }) {
  return (
    <div class="veil">
      <div class={cx('panel dialog', wide && 'wide')}>
        {children}
        {wide && <ScrollTab />}
      </div>
    </div>
  );
}
