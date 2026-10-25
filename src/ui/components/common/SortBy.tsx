// The Sort by list over a list in a menu: the orders the list can be put in, with the one it is in showing.

import { css } from '../../../styled-system/css';
import { useHud } from '../../hooks/use-hud';

/** The words and the dropdown, side by side and small. */
const sortBy = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 's',
  fontSize: '12',
  whiteSpace: 'nowrap',
  '& > span': { opacity: 'muted' },
});

/** The dropdown, drawn as one of the menus' small tabs, with a chevron for the list it opens. */
const select = css({
  appearance: 'none',
  font: 'inherit',
  fontSize: '13',
  fontWeight: '[500]',
  color: 'navy',
  background:
    "[#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%2324384a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") no-repeat right 9px center / 10px 6px]",
  border: '[2px solid {colors.navy}]',
  borderRadius: '[11px]',
  p: '[3px 27px 3px 10px]',
  cursor: 'pointer',
  _hover: { bgColor: 'teal-tint', borderColor: 'teal-dark' },
  _focusVisible: { outline: '[2px solid {colors.teal}]', outlineOffset: '[2px]' },
  // where the browser lets the open list be drawn too, it is drawn as one of the game's panels
  '@supports (appearance: base-select)': {
    '&, &::picker(select)': { appearance: '[base-select]' },
    '&::picker-icon': { display: 'none' },
    // under the dropdown and lined up with its right edge, so it stays over the menu at the menu's right edge
    '&::picker(select)': {
      positionArea: 'block-end span-inline-start',
      mt: 'xs',
      p: 'xs',
      border: '[2.5px solid {colors.navy}]',
      borderRadius: '[12px]',
      bg: 'cream',
      boxShadow: 'raised',
    },
    '& option': { p: '[4px 10px]', borderRadius: '[8px]', fontSize: '13' },
    '& option::checkmark': { display: 'none' },
    '& option:hover, & option:focus-visible': { outline: '[none]', bg: 'teal-wash' },
    '& option:checked': { bg: 'teal', color: 'white', fontWeight: 'bold' },
  },
});
import { orderOf, type SortList, type SortOrder } from '../../lib/sorts';

/** A dropdown of the orders a list can be put in, which puts the list in the one picked. */
export function SortBy<T>({ list, orders }: { list: SortList; orders: readonly SortOrder<T>[] }) {
  const hud = useHud();
  return (
    <label class={`sort-by ${sortBy}`}>
      <span>Sort by</span>
      <select
        class={select}
        value={orderOf(orders, hud.sorts[list]).id}
        onChange={(e) => {
          const select = e.currentTarget;
          hud.sorts[list] = select.value;
          hud.host.audio.unlock();
          hud.host.audio.play('blip');
          hud.update();
          // let go of the keyboard, so the arrow keys move the camera again rather than stepping through the orders;
          // once the open list has shut, which hands the keyboard back to the dropdown as it goes
          setTimeout(() => {
            select.blur();
          });
        }}
        onKeyDown={(e) => {
          // Esc in the open list shuts the list, and leaves the menu under it open
          if (e.key === 'Escape' && e.target !== e.currentTarget) e.stopPropagation();
        }}
      >
        {orders.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
