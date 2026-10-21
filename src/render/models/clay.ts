// The guideline every item's model is held to, in numbers, so the items read as one family of soft clay shapes beside
// the people: no part so thin it reads as wire, corners rounded in proportion to the part, and nothing on one tile taller
// than a person's shoulder unless it is a machine or a cabinet. To be folded into parts.ts with the guideline's text.

import { rbox } from './parts';

/** The thinnest a leg, pole, rail or frame may be, across, in meters: thinner reads as wire at the default zoom. */
export const MEMBER = 0.06;

/** How high a person's shoulder is, in meters (people are about 1.1 m tall): the most a one-tile item stands, as a rule. */
export const SHOULDER = 0.95;

/** The standard corner radius for a box this size: a quarter of its thinnest side, and never more than 6 cm. */
export const radiusFor = (w: number, h: number, d: number) =>
  Math.max(0.005, Math.min(0.06, Math.round(Math.min(w, h, d) * 50) / 200));

/** A shared rounded box with the standard corner radius for its size. */
export const clay = (w: number, h: number, d: number) => rbox(w, h, d, radiusFor(w, h, d));
