// Guests' feelings about their visit, the reviews they write as they leave, and the parts of the center's reputation
// those reviews add up to.

import { type FeelingId, FEELINGS, REPUTATION_PARTS, type ReputationPart, REVIEWS_KEPT } from '../data';
import type { Guest, Review } from '../state/types';
import { at, clamp } from '../util';
import type { SimContext } from './context';
import type { VisitEnd } from './records';
import { afterVisit } from './regulars';

/** Note a feeling a guest has had, once. */
export function feel(g: Guest, id: FeelingId) {
  if (!g.feelings.includes(id)) g.feelings.push(id);
}

/** How a visit ended, for a review: a treatment's ends, or a class-goer's class held or missed. */
export type ReviewEnd = VisitEnd | 'class' | 'missed';

/** Where a review starts from, by how the visit ended, before what they felt along the way. */
const BASE_STARS: Readonly<Record<ReviewEnd, number>> = {
  class: 4,
  missed: 1,
  healed: 4,
  failed: 2,
  stormed: 1,
  sent: 2,
  priced: 2,
  worse: 1,
};

/** How a visit ended, as a feeling, if it is one. */
const END_FEELING: Readonly<Partial<Record<ReviewEnd, FeelingId>>> = {
  class: 'class',
  missed: 'no-class',
  healed: 'healed',
  failed: 'not-healed',
  sent: 'sent-home',
  worse: 'worse',
};

/** The stars a guest gives their visit: from how it ended, up half a star for each good feeling and down for each bad. */
export function reviewStars(end: ReviewEnd, feelings: readonly FeelingId[]): number {
  let stars = BASE_STARS[end];
  for (const f of feelings) {
    if (f === END_FEELING[end]) continue;
    stars += FEELINGS[f].good ? 0.5 : -0.5;
  }
  return clamp(Math.round(stars), 1, 5);
}

/** The latest of some feelings, preferring one about the visit itself to one about how it ended. */
function telling(feelings: readonly FeelingId[]): FeelingId | undefined {
  const outcomes = Object.values(END_FEELING);
  return feelings.filter((f) => !outcomes.includes(f)).at(-1) ?? feelings.at(-1);
}

/**
 * What a guest writes: a line about the feeling that told them most, a bad one if the visit went badly and a good one
 * if it went well. Which of its lines is settled by who they are, so the same visit always reads the same.
 */
export function reviewText(g: Guest, stars: number): string {
  const good = g.feelings.filter((f) => FEELINGS[f].good);
  const bad = g.feelings.filter((f) => !FEELINGS[f].good);
  const chosen = stars >= 3 ? (telling(good) ?? telling(bad)) : (telling(bad) ?? telling(good));
  if (!chosen) return stars >= 3 ? 'No complaints.' : 'Not for me.';
  const lines = FEELINGS[chosen].lines;
  return at(lines, g.id % lines.length);
}

/** File a leaving guest's review, keeping only the latest, and let it settle whether they come back. */
export function writeReview(ctx: SimContext, g: Guest, end: ReviewEnd) {
  const outcome = END_FEELING[end];
  if (outcome) feel(g, outcome);
  const stars = reviewStars(end, g.feelings);
  const s = ctx.s;
  s.reviews.push({ name: g.name, stars, text: reviewText(g, stars), day: s.day, feelings: [...g.feelings] });
  if (s.reviews.length > REVIEWS_KEPT) s.reviews.splice(0, s.reviews.length - REVIEWS_KEPT);
  afterVisit(ctx, g, stars, end === 'healed');
}

/** How the center is spoken of, part by part, from 0 to 100: half good and half bad feelings is 50. */
export type PartScores = Record<ReputationPart | 'word', number | null>;

/**
 * The parts of the center's reputation, from its latest reviews: for each part, the share of the feelings about it
 * that were good; and word of mouth, from the stars given. Null for a part nobody has mentioned.
 */
export function reputationParts(reviews: readonly Review[]): PartScores {
  const out: PartScores = { results: null, experience: null, value: null, staff: null, word: null };
  for (const part of REPUTATION_PARTS) {
    let good = 0;
    let bad = 0;
    for (const r of reviews) {
      for (const f of r.feelings) {
        if (FEELINGS[f].part !== part) continue;
        if (FEELINGS[f].good) good++;
        else bad++;
      }
    }
    if (good + bad) out[part] = Math.round((good / (good + bad)) * 100);
  }
  if (reviews.length) {
    const average = reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length;
    out.word = Math.round(((average - 1) / 4) * 100);
  }
  return out;
}
