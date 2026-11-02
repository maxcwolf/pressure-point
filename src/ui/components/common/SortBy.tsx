// The Sort by list over a list in a menu: the orders the list can be put in, with the one it is in showing.

import { useHud } from '../../hooks/use-hud';
import { orderOf, type SortList, type SortOrder } from '../../lib/sorts';
import { Dropdown } from './Dropdown';

/** A dropdown of the orders a list can be put in, which puts the list in the one picked. */
export function SortBy<T>({ list, orders }: { list: SortList; orders: readonly SortOrder<T>[] }) {
  const hud = useHud();
  return (
    <Dropdown
      name="sort-by"
      words="Sort by"
      value={orderOf(orders, hud.sorts[list]).id}
      choices={orders}
      onPick={(id) => {
        hud.sorts[list] = id;
      }}
    />
  );
}
