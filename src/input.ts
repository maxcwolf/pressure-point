// Telling a click from a drag.
//
// A press only becomes a drag once the pointer has traveled a little way. Hands and
// trackpads drift a few pixels during an ordinary click, and that must still be a click.

/** Travel, in pixels, beyond which a press counts as a drag. */
export const DRAG_PX = 10;
/** A press released within this many milliseconds is a click even if the pointer skidded... */
export const QUICK_MS = 200;
/** ...as long as it skidded less than this many pixels. */
export const QUICK_PX = 20;

/** Has the pointer moved far enough from where it was pressed to be dragging? */
export function isDragging(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > DRAG_PX;
}

/** Should a release count as a click? A quick press that skidded only a little still does. */
export function isClick(dragged: boolean, heldMs: number, traveled: number): boolean {
  return !dragged || (heldMs < QUICK_MS && traveled < QUICK_PX);
}
