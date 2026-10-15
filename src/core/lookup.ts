// Finding a room, item or person by id without searching the whole list each time.

/** Where each entry of a list was last seen, by id, for every list looked in. */
const positions = new WeakMap<readonly { id: number }[], Map<number, number>>();

/**
 * The entry with this id in a list, if there is one. Where each entry sits is remembered and checked on every look,
 * since the list may have changed since: an entry added, removed or replaced. An entry that has moved is found by
 * searching, as is an id that is not there, and finding one that has moved works out where everything is afresh.
 */
export function byId<T extends { id: number }>(list: readonly T[], id: number): T | undefined {
  let pos = positions.get(list);
  if (!pos) {
    pos = new Map();
    positions.set(list, pos);
  }
  const seen = list[pos.get(id) ?? -1];
  if (seen?.id === id) return seen;
  const found = list.find((e) => e.id === id);
  if (found) {
    pos.clear();
    // the first of any two with the same id, as a search finds
    list.forEach((e, i) => !pos.has(e.id) && pos.set(e.id, i));
  }
  return found;
}
