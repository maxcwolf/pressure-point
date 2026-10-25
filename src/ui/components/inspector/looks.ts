// The inspector's own buttons, shared by its parts: the small buttons with words, and the switches for duties.

import { css } from '../../../styled-system/css';

/**
 * A small button with words, such as Move, a raise or cancelling a course: a smaller cousin of the dialogs' buttons. A
 * raise they asked for, or a promotion, is gold.
 */
export const smallButton = css({
  border: '[2.5px solid {colors.navy}]',
  borderRadius: 'card',
  p: '[5px 13px]',
  fontWeight: 'bold',
  fontSize: 'body',
  bg: 'cream',
  boxShadow: '[0 3px 0 {colors.ink.30}]',
  mt: 's',
  '&.go': { bg: 'gold', color: 'navy' },
});

/** A row of duty switches, or of the small buttons beside them. */
export const dutyRow = css({ display: 'flex', flexWrap: 'wrap', gap: 'xs' });

/**
 * A switch for a duty, or a small button beside them. A duty they are on, or the assigning under way, is tinted, while
 * one they are kept from stays plain but just as bright; their only duty left, which cannot be taken away, is faded.
 */
export const duty = css({
  border: 'control',
  borderRadius: 'control',
  p: '[2px 8px]',
  fontSize: '[12px]',
  fontWeight: 'bold',
  bg: 'white',
  _on: { bg: 'good-bg' },
  _locked: { opacity: '[0.55]', cursor: 'not-allowed' },
});
