// The one window every wall uses, a room's own or the building's: a frame with glazing bars, a ledge under it, and
// glass. Standing tall it is the whole window; cut low with its wall, it is drawn as its cut section on top of the
// wall, so it neither vanishes nor stands up out of the wall. Windows side by side are one wide window, with a bar
// where each tile meets the next. Nothing here draws anything, so it can be tested without a renderer.

import type { WallBox, WallMaterial } from './room-walls';

/** A window to build, spanning whole tiles along one wall. */
export interface WindowSpec {
  /** True for the north and south walls, which run along x. */
  horizontal: boolean;
  /** Where the middle of the wall is, across it, and how thick the wall is. */
  fixed: number;
  thick: number;
  /** Which way is in, 1 or -1: the face seen while the wall stands tall. */
  inward: number;
  /** The tiles it spans along the wall. */
  a: number;
  b: number;
  tall: boolean;
  /** The bottom of the glass and its height, standing tall. */
  sill: number;
  pane: number;
  /** The top of the wall when it is cut low, where the window's section is drawn. */
  lowTop: number;
  /**
   * Set into an opening in a room's own wall, the wall drawn around it, or hung on the inside face of the building's
   * wall, which carries on behind it.
   */
  inset: boolean;
  /** What the frame and bars are made of, the ledge, and the glass: see-through in a room's own wall. */
  frame: WallMaterial;
  ledge: WallMaterial;
  glass: WallMaterial;
}

/** How wide the frame's sides are, the glazing bars, and how deep the frame stands. */
const JAMB = 0.06;
const BAR = 0.04;
const RAIL = 0.05;
/** How far the ledge reaches past the frame at each end, and how far it stands out from the wall. */
const LEDGE_OVER = 0.04;
const LEDGE_OUT = 0.06;
/** How high up the pane its crossbar is. */
const TRANSOM = 0.58;

/** Every box of a window. */
export function windowBoxes(w: WindowSpec): WallBox[] {
  const { horizontal, fixed, thick, inward, a, b, frame, ledge, glass } = w;
  const boxes: WallBox[] = [];
  /** Add a box along the wall from p to q, `deep` thick, its middle `off` in from the middle of the wall. */
  const box = (p: number, q: number, y0: number, h: number, deep: number, material: WallMaterial, off = 0) => {
    if (q - p <= 0.001) return;
    boxes.push({ horizontal, fixed: fixed + off * inward, a: p, b: q, y0, h, thick: deep, material });
  };
  /** Where a tile meets the next inside the window, for a glazing bar. */
  const joins: number[] = [];
  for (let t = a + 1; t < b; t++) joins.push(t);

  if (!w.tall) {
    // cut low: the frame's section on top of the wall, a line of glass in it, and a ledge either side below
    const y = w.lowTop;
    const deep = thick + 0.04;
    box(a, b, y, 0.04, deep, frame);
    box(a + JAMB, b - JAMB, y + 0.04, 0.03, 0.03, glass);
    for (const p of [a, b - JAMB]) box(p, p + JAMB, y + 0.04, 0.06, deep * 0.7, frame);
    for (const t of joins) box(t - BAR / 2, t + BAR / 2, y + 0.04, 0.05, deep * 0.6, frame);
    box(a - LEDGE_OVER, b + LEDGE_OVER, y - 0.12, 0.03, thick + 2 * LEDGE_OUT, ledge);
    return boxes;
  }

  const { sill, pane } = w;
  const top = sill + pane;
  // set into a room's wall the window fills its depth; hung on the building's wall it stands on the inside face
  const face = w.inset ? 0 : thick / 2;
  const deep = w.inset ? thick + 0.03 : 0.06;
  const at = w.inset ? 0 : face + deep / 2;
  box(a + JAMB, b - JAMB, sill, pane, 0.03, glass, w.inset ? 0 : face + 0.015);
  box(a, b, sill - RAIL + 0.02, RAIL, deep, frame, at);
  box(a, b, top - 0.02, RAIL, deep, frame, at);
  for (const p of [a, b - JAMB]) box(p, p + JAMB, sill, pane, deep, frame, at);
  // the bars: one up each join between tiles, and one across the whole window
  for (const t of joins) box(t - BAR / 2, t + BAR / 2, sill, pane, deep * 0.8, frame, at);
  box(a + JAMB, b - JAMB, sill + pane * TRANSOM - 0.015, 0.03, deep * 0.8, frame, at);
  // the ledge under it: through the wall and out both sides for a room's wall, out from the face for the building's
  if (w.inset) box(a - LEDGE_OVER, b + LEDGE_OVER, sill - RAIL - 0.02, 0.03, thick + 2 * LEDGE_OUT, ledge);
  else
    box(
      a - LEDGE_OVER,
      b + LEDGE_OVER,
      sill - RAIL - 0.02,
      0.03,
      LEDGE_OUT + 0.04,
      ledge,
      face + (LEDGE_OUT + 0.04) / 2,
    );
  return boxes;
}

/** Windows side by side along one wall joined into spans, from a list of the tiles that have one. */
export function windowSpans(tiles: readonly number[]): [a: number, b: number][] {
  const sorted = [...new Set(tiles)].sort((x, y) => x - y);
  const spans: [number, number][] = [];
  for (const t of sorted) {
    const last = spans.at(-1);
    if (last?.[1] === t) last[1] = t + 1;
    else spans.push([t, t + 1]);
  }
  return spans;
}
