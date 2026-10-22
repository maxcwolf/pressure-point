// The outline of a round button whose word is wider than the circle where it sits: the circle and a plate round the
// word drawn as one path, with concave fillets wherever the plate's edge meets the circle, so the border steps out
// round the word's ends and back without a corner. The Treatments button draws itself this way.

/** A plate round a word: its centre's distance below the circle's centre, and its outer half sizes, stroke included. */
export interface Plate {
  cy: number;
  hx: number;
  hy: number;
}

/** A welded outline: the path on the stroke's centreline, origin at the circle's centre, and how far down it reaches. */
export interface Weld {
  d: string;
  yMax: number;
}

/** A number as the path writes it, to the hundredth of a pixel. */
const n = (v: number) => Number(v.toFixed(2));
/** A point as the path writes it. */
const pt = (q: readonly [number, number]) => `${n(q[0])} ${n(q[1])}`;

/** One piece of the outline: an arc of radius `a` with sweep `s`, or a straight line when `a` is left out. */
interface Segment {
  a?: number;
  s?: 0 | 1;
  to: readonly [number, number];
}

/** Where a fillet sits: its centre and the point where it touches the plate. */
interface Junction {
  centre: readonly [number, number];
  onPlate: readonly [number, number];
  onLine: boolean;
}

/**
 * The outline of a circle `diameter` across with a plate round the word, as `weldPath` draws it. A plate that stays
 * inside the circle gives the plain circle. A plate whose bottom edge is at or below the circle's hangs below it.
 */
export function weldPath(diameter: number, plate: Plate, stroke = 3, fillet = 4): Weld {
  const Rc = diameter / 2 - stroke / 2;
  const xs = plate.hx - stroke / 2;
  const hp = plate.hy - stroke / 2;
  const yc = plate.cy;
  const ex = xs - hp; // the right end cap's centre
  const yT = yc - hp; // the plate's top edge
  const yB = yc + hp; // and bottom edge
  const f = fillet;
  if (Math.hypot(xs, yc) <= Rc) {
    const r = n(Rc);
    return { d: `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`, yMax: Rc };
  }
  /** The fillet where one edge of the plate (-1 the top, +1 the bottom) meets the circle: against the edge, or the end cap. */
  const junction = (sign: -1 | 1): Junction => {
    const yLine = yc + sign * hp;
    const fy = yLine + sign * f;
    const fx = Math.sqrt(Math.max(0, (Rc + f) ** 2 - fy * fy));
    if (fx <= ex) return { centre: [fx, fy], onPlate: [fx, yLine], onLine: true };
    // against the cap: as far from the circle's centre as Rc + f and from the cap's as hp + f, on the plate's outer side
    const d = Math.hypot(ex, yc);
    const r0 = Rc + f;
    const r1 = hp + f;
    const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
    const mx = (a * ex) / d;
    const my = (a * yc) / d;
    const c1: [number, number] = [mx + (h * yc) / d, my - (h * ex) / d];
    const c2: [number, number] = [mx - (h * yc) / d, my + (h * ex) / d];
    const centre = sign < 0 ? (c1[1] < c2[1] ? c1 : c2) : c1[1] > c2[1] ? c1 : c2;
    return { centre, onPlate: [ex + ((centre[0] - ex) * hp) / r1, yc + ((centre[1] - yc) * hp) / r1], onLine: false };
  };
  /** Where a fillet touches the circle: on the line from the circle's centre to the fillet's. */
  const onCircle = (j: Junction): [number, number] => [(j.centre[0] * Rc) / (Rc + f), (j.centre[1] * Rc) / (Rc + f)];
  const top = junction(-1);
  const bottom = yB + f >= Rc ? null : junction(1);
  // the right half, clockwise from the top of the circle
  const segs: Segment[] = [
    { a: Rc, s: 1, to: onCircle(top) },
    { a: f, s: 0, to: top.onPlate },
  ];
  if (top.onLine) segs.push({ to: [ex, yT] });
  if (bottom) {
    if (bottom.onLine) segs.push({ a: hp, s: 1, to: [ex, yB] }, { to: bottom.onPlate });
    else segs.push({ a: hp, s: 1, to: bottom.onPlate });
    segs.push({ a: f, s: 0, to: onCircle(bottom) }, { a: Rc, s: 1, to: [0, Rc] });
  } else {
    segs.push({ a: hp, s: 1, to: [ex, yB] }, { to: [0, yB] });
  }
  /** A segment's command, going to a point: an arc of its radius and sweep, or a line. */
  const seg = (g: Segment, to: readonly [number, number]) =>
    g.a ? `A ${n(g.a)} ${n(g.a)} 0 0 ${g.s ?? 0} ${pt(to)}` : `L ${pt(to)}`;
  const d = [`M 0 ${n(-Rc)}`, ...segs.map((g) => seg(g, g.to))];
  // the left half is the mirror image, walked back up from the bottom: the same segments in reverse, mirrored
  const starts: (readonly [number, number])[] = [[0, -Rc], ...segs.slice(0, -1).map((g) => g.to)];
  for (let i = segs.length - 1; i >= 0; i--) {
    const g = segs[i];
    const from = starts[i];
    if (g && from) d.push(seg(g, [-from[0], from[1]]));
  }
  d.push('Z');
  return { d: d.join(' '), yMax: Math.max(Rc, yB) };
}

/** Where a welded button's drawing goes: the path, its viewBox, and its size and place within the button, in pixels. */
export interface WeldShape {
  d: string;
  viewBox: string;
  width: number;
  height: number;
  left: number;
  top: number;
}

/** How much room the plate gives the word on each side and above and below, stroke included, in pixels. */
export const PLATE_ROOM = { x: 7, y: 3 };

/**
 * The drawing for a round button `diameter` across whose word's box sits `top` pixels down inside it, `width` by
 * `height`: the plate hugs the word where it is, so the word stays level with the other buttons' words.
 */
export function weldShape(
  diameter: number,
  word: { top: number; width: number; height: number },
  stroke = 3,
): WeldShape {
  const plate: Plate = {
    cy: word.top + word.height / 2 - diameter / 2,
    hx: word.width / 2 + PLATE_ROOM.x,
    hy: word.height / 2 + PLATE_ROOM.y,
  };
  // a fillet in proportion to the button, to the nearest half pixel, and never so tight it looks like a corner
  const fillet = Math.max(2.5, Math.round(diameter * 0.05 * 2) / 2);
  const { d, yMax } = weldPath(diameter, plate, stroke, fillet);
  // room for the stroke all round, and a little more below for the shadow
  const vx = Math.max(diameter / 2, plate.hx) + stroke + 2;
  const vy = diameter / 2 + stroke + 2;
  const width = vx * 2;
  const height = vy + yMax + stroke + 2;
  return {
    d,
    viewBox: `${n(-vx)} ${n(-vy)} ${n(width)} ${n(height)}`,
    width,
    height,
    left: diameter / 2 - vx,
    top: diameter / 2 - vy,
  };
}
