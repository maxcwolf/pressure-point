// The one window every wall uses, a room's own or the building's: a frame with glazing bars, a ledge under it, and
// glass. Standing tall it is the whole window. Cut low with its wall, it is cut with it: a strip of its glass set into
// the top of the stub of wall, between the ends of its frame, so the window still shows where it is without standing
// in the air over the stub, in front of the people in the room. Windows side by side are one wide window, with a bar
// where each tile meets the next. Nothing here draws anything, so it can be tested without a renderer.

import type { WallBox, WallMaterial } from './room-walls';
import { H_LOW } from './shared';

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
  /** Whether its wall stands tall, or is cut low, so the window is cut with it, down to a strip along its top. */
  tall: boolean;
  /** The bottom of the glass and its height. */
  sill: number;
  pane: number;
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

/**
 * The top of a stub of wall cut low, and how tall and deep the strip of glass set along it is: a room's own wall stops
 * at `H_LOW`, where its trim would run, so the glass takes the trim's place; the building's wall runs on under its teal
 * cap, so the glass lies along the top of the cap.
 */
export const LOW_INLAY = {
  room: { y0: H_LOW, h: 0.07, over: 0.05 },
  building: { y0: H_LOW + 0.12, h: 0.03, over: -0.08 },
} as const;

/** Every box of a window: standing tall, the whole window; cut low, a strip of glass along the top of its stub. */
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
    // the glass along the top of the stub, in the middle of the wall, between the frame's ends and its bars, which stand
    // a little proud of it so the window's tiles still show
    const inlay = w.inset ? LOW_INLAY.room : LOW_INLAY.building;
    const deep = thick + inlay.over;
    box(a + JAMB, b - JAMB, inlay.y0, inlay.h, deep, glass);
    for (const p of [a, b - JAMB]) box(p, p + JAMB, inlay.y0, inlay.h + 0.01, deep + 0.02, frame);
    for (const t of joins) box(t - BAR / 2, t + BAR / 2, inlay.y0, inlay.h + 0.01, deep + 0.02, frame);
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
