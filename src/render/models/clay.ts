// The model guideline's helpers, the same as those at the top of parts.ts on the branch that writes the guideline's
// text (claude/model-polish-a): kept here until the two branches meet, when every import of this file becomes one of
// parts.ts and this file goes.

import { rbox } from './parts';

/** The thinnest a structural member (a leg, post, pole, rail, frame or arch) may be across, in meters. */
export const MEMBER_MIN = 0.06;

/** The thinnest a structural member taller than a person may be across, in meters. */
export const MEMBER_TALL = 0.08;

/** The tallest a one-tile item may stand, in meters: a person and a half. */
export const TALL_MAX = 1.6;

/** The standard corner radius for a rounded box of this size: three tenths of its thinnest side, from 1.2 to 8 cm. */
export const corner = (w: number, h: number, d: number) => Math.min(0.08, Math.max(0.012, Math.min(w, h, d) * 0.3));

/** A shared rounded box with the standard corner for its size. */
export const soft = (w: number, h: number, d: number) => rbox(w, h, d, corner(w, h, d));
