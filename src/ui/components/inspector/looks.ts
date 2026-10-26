// The inspector's own buttons, shared by its parts: the small buttons with words, and the switches for duties.

import { css } from '../../../styled-system/css';

/**
 * A small button with words, such as Move, a raise or cancelling a course: a smaller cousin of the dialogs' buttons. A
 * raise they asked for, or a promotion, is gold.
 */
export const smallButton = css({
  border: 'outline',
  borderRadius: '12',
  py: '4',
  px: '12',
  fontWeight: 'bold',
  fontSize: '14',
  bg: 'control',
  boxShadow: '[0 3px 0 {colors.shadow}]',
  mt: '6',
  '&.go': { bg: 'highlight', color: 'fg' },
});

/** A row of duty switches, or of the small buttons beside them. */
export const dutyRow = css({ display: 'flex', flexWrap: 'wrap', gap: '4' });

/**
 * A switch for a duty, or a small button beside them. A duty they are on, or the assigning under way, is tinted, while
 * one they are kept from stays plain but just as bright; their only duty left, which cannot be taken away, is faded.
 */
export const duty = css({
  border: 'outline.thin',
  borderRadius: '8',
  py: '2',
  px: '8',
  fontSize: '12',
  fontWeight: 'bold',
  bg: 'bg.card',
  _on: { bg: 'good.bg' },
  _locked: { opacity: '[0.55]', cursor: 'not-allowed' },
});
