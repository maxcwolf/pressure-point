// The frame every dialog sits in.

import type { ComponentChildren } from 'preact';

import { css } from '../../../styled-system/css';
import { cx } from '../../lib/cx';
import { ScrollTab } from '../common/ScrollTab';

/**
 * The game dimmed behind a dialog, taking every click. With a dialog on its way out (Modal.tsx marks it as leaving),
 * the game brightens again as the dialog shrinks away, and takes no more clicks.
 */
const veil = css({
  position: 'fixed',
  inset: '[0]',
  display: 'grid',
  placeItems: 'center',
  bg: '[rgba(36, 56, 74, 0.45)]',
  pointerEvents: 'auto',
  zIndex: '[20]',
  animation: 'fadein 0.2s ease-out',
  '#modal.leaving &': { pointerEvents: 'none', animation: 'fadeout 0.14s ease-in forwards' },
});

/**
 * The dialog: a panel with its words centered, popping in, and shrinking away as it goes. A wide one scrolls once it is
 * taller than the window, and a second row of buttons sits close under the first.
 */
const dialog = css({
  w: '[min(460px, calc(var(--vw) - 40px))]',
  textAlign: 'center',
  p: '[22px 26px 24px]',
  animation: 'pop 0.2s ease-out',
  '#modal.leaving &': { animation: 'unpop 0.14s ease-in forwards' },
  '& h2': { fontSize: '[26px]', fontWeight: '[700]', mb: 'm' },
  '& p': { fontSize: '[15px]', lineHeight: '[1.35]' },
  '&.wide': {
    w: '[min(640px, calc(var(--vw) - 40px))]',
    maxH: '[calc(var(--vh) - 40px)]',
    overflowY: 'auto',
  },
  '& .btnrow + .btnrow': { mt: 'xxs' },
});

/** A panel over the game, with the game dimmed behind it. */
export function Dialog({ wide = false, children }: { wide?: boolean; children: ComponentChildren }) {
  return (
    <div class={veil}>
      {/* `dialog` and `wide` are for the scroll cues (ui/scroll-cue.ts and theme/panda/scroll-cue.ts) and the tests */}
      <div class={cx('panel dialog', dialog, wide && 'wide')}>
        {children}
        {wide && <ScrollTab />}
      </div>
    </div>
  );
}
