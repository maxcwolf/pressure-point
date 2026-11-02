// A dropdown with its words beside it, as over a list in a menu: the Sort by list, the Staff menu's job filter.

import { css } from '../../../styled-system/css';
import { useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';

/** The words and the dropdown, side by side and small. */
const labeled = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6',
  fontSize: '12',
  whiteSpace: 'nowrap',
  '& > span': { opacity: 'muted' },
});

/** The dropdown itself, drawn as one of the menus' small tabs, with a chevron for the list it opens. */
const select = css({
  appearance: 'none',
  font: 'inherit',
  fontSize: '13',
  fontWeight: 'medium',
  color: 'fg',
  background:
    "[{colors.bg.card} url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%2324384a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") no-repeat right {spacing.8} center / {sizes.10} {sizes.6}]",
  border: 'outline.thin',
  borderRadius: '10',
  p: '2',
  pr: '24',
  pl: '10',
  cursor: 'pointer',
  _hover: { bgColor: 'bg.hover', borderColor: 'accent.strong' },
  _focusVisible: { outline: 'focus', outlineOffset: '2' },
  // where the browser lets the open list be drawn too, it is drawn as one of the game's panels
  '@supports (appearance: base-select)': {
    '&, &::picker(select)': { appearance: '[base-select]' },
    '&::picker-icon': { display: 'none' },
    // under the dropdown and lined up with its right edge, so it stays over the menu at the menu's right edge
    '&::picker(select)': {
      positionArea: 'block-end span-inline-start',
      mt: '4',
      p: '4',
      border: 'outline',
      borderRadius: '12',
      bg: 'bg.panel',
      boxShadow: 'raised',
    },
    '& option': { py: '4', px: '10', borderRadius: '8', fontSize: '13' },
    '& option::checkmark': { display: 'none' },
    '& option:hover, & option:focus-visible': { outline: 'none', bg: 'bg.selected' },
    '& option:checked': { bg: 'accent', color: 'fg.on-accent', fontWeight: 'bold' },
  },
});
/** One choice in a dropdown: what is kept when it is picked, and what it says. */
export interface DropdownChoice {
  id: string;
  name: string;
}

/**
 * A dropdown of choices beside its words, which hands on the one picked. The plain class name on the label is for the
 * tests and the menus to find it by.
 */
export function Dropdown({
  name,
  words,
  value,
  choices,
  onPick,
}: {
  name: string;
  words: string;
  value: string;
  choices: readonly DropdownChoice[];
  onPick: (id: string) => void;
}) {
  const hud = useHud();
  return (
    <label class={cx(name, labeled)}>
      <span>{words}</span>
      <select
        class={select}
        value={value}
        onChange={(e) => {
          const select = e.currentTarget;
          onPick(select.value);
          hud.host.audio.unlock();
          hud.host.audio.play('blip');
          hud.update();
          // let go of the keyboard, so the arrow keys move the camera again rather than stepping through the choices;
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
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
