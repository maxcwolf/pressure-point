// The Sort by list over a list in a menu: the orders the list can be put in, with the one it is in showing.

import './SortBy.css';

import { useHud } from '../../hooks/use-hud';
import { orderOf, type SortList, type SortOrder } from '../../lib/sorts';

/** A dropdown of the orders a list can be put in, which puts the list in the one picked. */
export function SortBy<T>({ list, orders }: { list: SortList; orders: readonly SortOrder<T>[] }) {
  const hud = useHud();
  return (
    <label class="sort-by">
      <span>Sort by</span>
      <select
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
