// Which items show a marker for a Caretaker: a wrench over something broken, flies over something filthy. Markers over
// neighbouring items would stand one above another on screen, a tower that reads as one tall thing, so only one of a
// huddle shows, the most pressing: a breakdown before dirt, then the first placed.

import { DIRT_FILTHY, ITEMS } from '../core/data';
import type { Item } from '../core/state/types';
import { itemCenter } from '../core/world';

/** The markers over items, the most pressing first. */
export const ITEM_MARKERS = ['marker-broken', 'marker-filthy'] as const;
export type ItemMarker = (typeof ITEM_MARKERS)[number];

/** How near, in tiles from middle to middle, two items' markers would crowd each other: side by side, or corner to corner. */
export const MARKER_GAP = 1.6;

/** The marker an item needs, if any: a wrench when broken; flies when filthy, unless its linens show that on the table. */
export function markerOf(it: Item): ItemMarker | null {
  if (it.wear >= 100) return 'marker-broken';
  if (it.dirt >= DIRT_FILTHY && !ITEMS[it.type].linens) return 'marker-filthy';
  return null;
}

/** The marker each item shows, by its id: one for each huddle of items that need one. */
export function itemMarkers(items: readonly Item[]): Map<number, ItemMarker> {
  const wanting = items
    .map((it) => ({ it, marker: markerOf(it) }))
    .filter((w): w is { it: Item; marker: ItemMarker } => w.marker !== null)
    .sort((a, b) => ITEM_MARKERS.indexOf(a.marker) - ITEM_MARKERS.indexOf(b.marker) || a.it.id - b.it.id);
  const shown = new Map<number, ItemMarker>();
  const at: [number, number][] = [];
  for (const { it, marker } of wanting) {
    const [x, y] = itemCenter(it);
    if (at.some(([ax, ay]) => Math.hypot(x - ax, y - ay) < MARKER_GAP)) continue;
    at.push([x, y]);
    shown.set(it.id, marker);
  }
  return shown;
}
