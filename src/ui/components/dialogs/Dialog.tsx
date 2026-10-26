// The frame every dialog sits in.

import type { ComponentChildren } from 'preact';

import { css } from '../../../styled-system/css';
import { panelCard } from '../../../styled-system/recipes';
import { cx } from '../../lib/cx';
import { ScrollTab } from '../common/ScrollTab';

/**
 * The game dimmed behind a dialog, taking every click. With a dialog on its way out (Modal.tsx marks it as leaving),
 * the game brightens again as the dialog shrinks away, and takes no more clicks.
 */
const veil = css({
  position: 'fixed',
  inset: '0',
  display: 'grid',
  placeItems: 'center',
  bg: 'bg.backdrop',
  pointerEvents: 'auto',
  zIndex: 'modal',
  animation: '[fadein {durations.normal} {easings.out}]',
  '#modal.leaving &': { pointerEvents: 'none', animation: '[fadeout {durations.fast} {easings.in} forwards]' },
});

/**
 * The dialog: a panel with its words centered, popping in, and shrinking away as it goes. A wide one scrolls once it is
 * taller than the window, and a second row of buttons sits close under the first.
 */
const dialog = css({
  w: '[min(460px, calc(var(--vw) - 40px))]',
  textAlign: 'center',
  p: '24',
  pt: '20',
  animation: '[pop {durations.normal} {easings.out}]',
  '#modal.leaving &': { animation: '[unpop {durations.fast} {easings.in} forwards]' },
  '& h2': { fontSize: '24', fontWeight: 'heavy', mb: '8' },
  '& p': { fontSize: '15', lineHeight: 'snug' },
  '&.wide': {
    w: '[min(640px, calc(var(--vw) - 40px))]',
    maxH: '[calc(var(--vh) - 40px)]',
    overflowY: 'auto',
  },
  '& .btnrow + .btnrow': { mt: '2' },
});

/** A panel over the game, with the game dimmed behind it. */
export function Dialog({ wide = false, children }: { wide?: boolean; children: ComponentChildren }) {
  return (
    <div class={veil}>
      {/* `dialog` and `wide` are for the scroll cues (ui/scroll-cue.ts and theme/panda/scroll-cue.ts) and the tests */}
      <div class={cx(panelCard(), 'dialog', dialog, wide && 'wide')}>
        {children}
        {wide && <ScrollTab />}
      </div>
    </div>
  );
}
